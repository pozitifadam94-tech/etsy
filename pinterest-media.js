'use strict';

const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const {createHash} = require('node:crypto');

// These are conservative local download guards, not verified Pinterest quotas.
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function failure(code, message, status) {
  const error = Object.assign(new Error(message), {kind: 'image', code});
  if (Number.isInteger(status)) error.status = status;
  return error;
}

function imageUrl(value) {
  let url;
  try {
    if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) throw new Error();
    url = new URL(value);
  } catch (_) {
    throw failure('url', 'Etsy görsel adresi geçersiz.');
  }
  const host = url.hostname;
  const validHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*etsystatic\.com$/.test(host);
  if (url.protocol !== 'https:' || !validHost || host.length > 253 || url.username || url.password || url.hash || (url.port && url.port !== '443')) {
    throw failure('url', 'Görsel yalnızca güvenli Etsy CDN adresinden alınabilir.');
  }
  return url;
}

function ipv6Words(address) {
  if (net.isIP(address) !== 6 || address.includes('%') || address.includes('.')) return null;
  const halves = address.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  const words = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right].map(word => parseInt(word, 16));
  return words.length === 8 && words.every(word => Number.isInteger(word) && word >= 0 && word <= 65535) ? words : null;
}

function publicAddress(address) {
  if (typeof address !== 'string') return false;
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  const words = ipv6Words(address);
  // Only native global unicast. Deny mapped/NAT64, local, multicast, tunnel,
  // benchmark, documentation and special-use ranges, including private IPv6.
  return Boolean(words && (words[0] & 0xe000) === 0x2000
    && words[0] !== 0x2002
    && !(words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8))
    && !((words[0] & 0xfff0) === 0x3ff0));
}

function addressKey(address) {
  if (net.isIP(address) === 4) return address;
  // Native sockets may report an IPv4 connection with a mapped address.
  if (typeof address === 'string' && /^::ffff:(?:\d{1,3}\.){3}\d{1,3}$/i.test(address)) return address.slice(7);
  const words = ipv6Words(address);
  return words ? words.map(word => word.toString(16)).join(':') : null;
}

function resolveAddresses(lookup, hostname) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error, value, family) => {
      if (settled) return;
      settled = true;
      if (error) return reject(failure('dns', 'Etsy görsel sunucusunun adresi çözülemedi.'));
      const records = Array.isArray(value) ? value : typeof value === 'string' ? [{address: value, family}] : [value];
      if (!records.length || records.length > 64 || records.some(record => !record || !publicAddress(record.address)
        || Number(record.family) !== net.isIP(record.address))) {
        return reject(failure('dns', 'Görsel sunucusu genel ağ dışında veya doğrulanamayan bir adrese çözüldü.'));
      }
      resolve(records.map(record => Object.freeze({address: record.address, family: Number(record.family)})));
    };
    try {
      const returned = lookup(hostname, {all: true, verbatim: true}, done);
      if (returned && typeof returned.then === 'function') returned.then(value => done(null, value), done);
      else if (Array.isArray(returned)) done(null, returned);
    } catch (_) {
      done(new Error());
    }
  });
}

function pinnedLookup(hostname, records) {
  return function lookupPinned(requested, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    const family = typeof options === 'number' ? options : Number(options && options.family) || 0;
    const candidates = family ? records.filter(record => record.family === family) : records;
    if (requested !== hostname || !candidates.length) return callback(failure('dns', 'Görsel bağlantısının sabitlenmiş adresi geçersiz.'));
    if (options && options.all) callback(null, candidates.map(record => ({...record})));
    else callback(null, candidates[0].address, candidates[0].family);
  };
}

function header(response, name) {
  const value = response.headers && response.headers[name];
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function declaredSize(response, limit) {
  const raw = response.headers && response.headers['content-length'];
  if (raw === undefined) return null;
  if ((typeof raw !== 'string' && typeof raw !== 'number') || !/^\d+$/.test(String(raw))) {
    throw failure('size', 'Görsel boyut başlığı geçersiz.');
  }
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 1 || length > limit) throw failure('size', 'Görsel yerel indirme boyut sınırını aşıyor veya boş.');
  return length;
}

function readImage(response, limit, length) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ended = false;
    let bytes = 0;
    const chunks = [];
    const cleanup = () => {
      response.removeListener('data', onData);
      response.removeListener('end', onEnd);
      response.removeListener('aborted', onAbort);
      response.removeListener('close', onClose);
      // Retain the error handler: destroy() can emit an error after cleanup.
    };
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) { reject(error); response.destroy(); }
      else resolve(data);
    };
    const onData = chunk => {
      if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) return finish(failure('magic', 'Görsel akışı özgün binary veri içermiyor.'));
      bytes += chunk.byteLength;
      if (bytes > limit || (length !== null && bytes > length)) return finish(failure('size', 'Görsel yerel indirme boyut sınırını aşıyor.'));
      chunks.push(Buffer.from(chunk));
    };
    const onEnd = () => {
      ended = true;
      if (!bytes || (length !== null && bytes !== length)) return finish(failure('size', 'Görsel indirmesi eksik veya boş.'));
      finish(null, Buffer.concat(chunks, bytes));
    };
    const onAbort = () => finish(failure('network', 'Görsel indirmesi yarıda kesildi.'));
    const onClose = () => { if (!ended) onAbort(); };
    response.on('error', onAbort);
    response.on('aborted', onAbort);
    response.on('close', onClose);
    response.on('end', onEnd);
    response.on('data', onData);
  });
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[i] = value >>> 0;
}

function crc32(data, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(data) {
  if (data.length < 45 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error();
  let offset = 8;
  let dimensions;
  let imageData = false;
  let dataEnded = false;
  let palette = false;
  let color;
  while (offset + 12 <= data.length) {
    const size = data.readUInt32BE(offset);
    if (size > data.length - offset - 12) throw new Error();
    const type = data.toString('latin1', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(data, offset + 4, offset + 8 + size) !== data.readUInt32BE(offset + 8 + size)) throw new Error();
    if (!dimensions && type !== 'IHDR') throw new Error();
    if (type === 'IHDR') {
      if (dimensions || size !== 13) throw new Error();
      const width = data.readUInt32BE(offset + 8);
      const height = data.readUInt32BE(offset + 12);
      const depth = data[offset + 16];
      color = data[offset + 17];
      const depths = {0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16]};
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || !depths[color] || !depths[color].includes(depth)
        || data[offset + 18] !== 0 || data[offset + 19] !== 0 || data[offset + 20] > 1) throw new Error();
      dimensions = {width, height};
    } else if (type === 'PLTE') {
      if (palette || imageData || !size || size % 3 || size > 768 || color === 0 || color === 4) throw new Error();
      palette = true;
    } else if (type === 'IDAT') {
      if (dataEnded || (color === 3 && !palette)) throw new Error();
      imageData = true;
    } else if (type === 'IEND') {
      if (size || !imageData || offset + 12 !== data.length) throw new Error();
      return dimensions;
    } else {
      if (imageData) dataEnded = true;
      if (type[0] === type[0].toUpperCase()) throw new Error();
    }
    offset += size + 12;
  }
  throw new Error();
}

function jpegDimensions(data) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error();
  let offset = 2;
  let dimensions;
  let scan = false;
  let sawScan = false;
  const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < data.length) {
    if (scan) {
      while (offset < data.length && data[offset] !== 0xff) offset++;
    }
    if (data[offset++] !== 0xff) throw new Error();
    while (offset < data.length && data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (scan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    if (marker === 0xd9) {
      if (!dimensions || !sawScan || offset !== data.length) throw new Error();
      return dimensions;
    }
    if (marker === 0x01) continue;
    if (!marker || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || offset + 2 > data.length) throw new Error();
    scan = false;
    const length = data.readUInt16BE(offset);
    if (length < 2 || length > data.length - offset) throw new Error();
    if (frames.has(marker)) {
      if (dimensions || length < 11 || length !== 8 + 3 * data[offset + 7]) throw new Error();
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      if (!width || !height) throw new Error();
      dimensions = {width, height};
    } else if (marker === 0xda) {
      if (!dimensions || length < 8 || length !== 6 + 2 * data[offset + 2]) throw new Error();
      sawScan = true;
      scan = true;
    }
    offset += length;
  }
  throw new Error();
}

function inspectImage(data, mime) {
  try { return mime === 'image/png' ? pngDimensions(data) : jpegDimensions(data); }
  catch (_) { throw failure('magic', 'Görsel JPEG/PNG içeriğiyle eşleşmiyor, bozuk veya eksik. Başka görsele geçilmedi.'); }
}

function bounded(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(fallback, Math.floor(value))) : fallback;
}

/**
 * lookup follows dns.lookup(host, {all:true, verbatim:true}, callback).
 * requestImpl follows https.request(URL, options, callback); tests may inject it.
 * The production path uses native verified HTTPS with validated DNS pinned to
 * this connection, never an automatic redirect or global fetch transport.
 */
function createMediaFetcher({lookup = dns.lookup, requestImpl = https.request, timeoutMs, maxBytes} = {}) {
  if (typeof lookup !== 'function' || typeof requestImpl !== 'function') throw new TypeError('Görsel taşıma yapılandırması geçersiz.');
  const timeout = bounded(timeoutMs, TIMEOUT_MS);
  const limit = bounded(maxBytes, MAX_BYTES);
  return async function fetchImage(value) {
    let current = imageUrl(value);
    const controller = new AbortController();
    let currentRequest;
    let currentResponse;
    let timer;
    const expiresAt = Date.now() + timeout;
    const timeoutError = failure('timeout', 'Etsy görsel indirmesi zaman aşımına uğradı.');
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(timeoutError);
        controller.abort();
        if (currentResponse) currentResponse.destroy();
        if (currentRequest) currentRequest.destroy();
      }, timeout);
    });
    const until = promise => Promise.race([promise, deadline]);
    const visited = new Set([current.href]);
    let redirects = 0;
    try {
      while (true) {
        const records = await until(resolveAddresses(lookup, current.hostname));
        currentResponse = await until(new Promise((resolve, reject) => {
          try {
            currentRequest = requestImpl(current, {
              method: 'GET', agent: false, rejectUnauthorized: true,
              servername: current.hostname, lookup: pinnedLookup(current.hostname, records),
              signal: controller.signal,
              headers: {accept: 'image/jpeg, image/png', 'accept-encoding': 'identity'}
            }, response => {
              // A transport that arrives after cancellation must not leave an
              // unconsumed stream alive, even when an injected stub ignores it.
              if (controller.signal.aborted) {
                if (response && typeof response.destroy === 'function') response.destroy();
                reject(timeoutError);
                return;
              }
              if (response && typeof response.on === 'function') response.on('error', () => {});
              resolve(response);
            });
            currentRequest.on('error', () => reject(controller.signal.aborted ? timeoutError : failure('network', 'Etsy görsel bağlantısı kurulamadı.')));
            currentRequest.end();
          } catch (_) { reject(failure('network', 'Etsy görsel bağlantısı kurulamadı.')); }
        }));
        const response = currentResponse;
        if (!response || typeof response.on !== 'function' || typeof response.destroy !== 'function') throw failure('network', 'Görsel yanıtı sınırlı bir veri akışı sağlamıyor.');
        const socket = response.socket;
        if (socket && (socket.authorized === false || socket.encrypted === false)) throw failure('tls', 'Etsy görsel bağlantısının TLS doğrulaması başarısız.');
        if (socket && socket.remoteAddress && !records.some(record => addressKey(record.address) === addressKey(socket.remoteAddress))) {
          throw failure('dns', 'Görsel bağlantısı doğrulanan sunucu adresiyle eşleşmiyor.');
        }
        const status = Number(response.statusCode);
        if (REDIRECTS.has(status)) {
          const location = header(response, 'location');
          response.destroy();
          if (redirects++ >= MAX_REDIRECTS || !location || location.length > 4096) throw failure('redirect', 'Görsel yönlendirmesi eksik veya yerel yönlendirme sınırı aşıldı.');
          let next;
          try { next = imageUrl(new URL(location, current).href); }
          catch (_) { throw failure('redirect', 'Görsel yönlendirmesi güvenli Etsy CDN dışına çıkıyor.'); }
          if (visited.has(next.href)) throw failure('redirect', 'Görsel yönlendirmesi döngü oluşturuyor.');
          visited.add(next.href);
          current = next;
          continue;
        }
        if (status !== 200) throw failure('http', 'Etsy görseli alınamadı. İlgili ürün paylaşılmadı.', status);
        const mime = header(response, 'content-type').split(';', 1)[0].toLowerCase();
        if (mime !== 'image/jpeg' && mime !== 'image/png') {
          throw failure('mime', 'Pinterest için özgün JPEG veya PNG görsel gerekir. Desteklenmeyen biçim dönüştürülmedi ve başka görsele geçilmedi.');
        }
        const encoding = header(response, 'content-encoding').toLowerCase();
        if (encoding && encoding !== 'identity') throw failure('mime', 'Görsel yanıtı özgün JPEG/PNG byte akışı değil.');
        const length = declaredSize(response, limit);
        const data = await until(readImage(response, limit, length));
        const dimensions = inspectImage(data, mime);
        if (Date.now() >= expiresAt) throw timeoutError;
        return {content_type: mime, data, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length, ...dimensions};
      }
    } catch (error) {
      if (currentResponse && typeof currentResponse.destroy === 'function') currentResponse.destroy();
      if (currentRequest && typeof currentRequest.destroy === 'function') currentRequest.destroy();
      if (error && error.kind === 'image') throw error;
      throw failure('network', 'Etsy görseli güvenli biçimde alınamadı.');
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = {createMediaFetcher};
