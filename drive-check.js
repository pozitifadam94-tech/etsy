'use strict';

// This checker has no connection to owner OAuth tokens or browser cookies.
// It reads one bounded, anonymous HTML page, never a Drive file/archive.
const CACHE_MS = 10 * 60 * 1000;
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;
const CACHE_LIMIT = 100;
const REDIRECT_HOSTS = new Set(['drive.google.com', 'accounts.google.com']);

function folderUrl(value) {
  return require('./public/delivery').parseFolderUrl(value);
}

function headersValue(response, name) {
  return response.headers && typeof response.headers.get === 'function'
    ? response.headers.get(name) || '' : '';
}

function cancelBody(response) {
  if (response.body && typeof response.body.cancel === 'function') {
    // Some responses are already locked or exhausted. Cancellation is best effort.
    try { Promise.resolve(response.body.cancel()).catch(() => {}); } catch (_) {}
  }
}

function retrySeconds(value, now) {
  if (!value || value.length > 80) return 600;
  const seconds = /^\d+$/.test(value.trim())
    ? Number(value.trim()) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(60, Math.min(3600, seconds)) : 600;
}

function visibleHtml(body) {
  return body.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
}

function inspectHtml(body, status) {
  const html = visibleHtml(body);
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  if (/captcha|unusual traffic|automated queries|olağandışı trafik|reCAPTCHA/i.test(text)) {
    return {status: 'unknown', reason: 'Google bir doğrulama veya trafik engeli gösterdi. Müşteri erişimi belirlenemedi.'};
  }
  if (/you need access|you need permission|request access|erişim iste|erişim izni|izin gerekiyor/i.test(text)) {
    return {status: 'permission', reason: 'Anonim sayfada erişim izni isteme veya erişim reddi görüldü. Paylaşım ayarı değiştirilmedi.'};
  }
  if (/<title\b[^>]*>[^<]*(?:sign in|oturum aç)[^<]*<\/title>/i.test(html)
    || (/accounts\.google\.com\/(?:ServiceLogin|signin)/i.test(html)
      && /to continue to google drive|google drive['’]?a devam etmek/i.test(text))) {
    return {status: 'permission', reason: 'Anonim sayfa Google hesabıyla oturum açılmasını istiyor. Müşterinin erişimi doğrulanmadı.'};
  }
  if (status === 404 || status === 410 || /the file you have requested does not exist|dosya mevcut değil|dosya bulunamadı/i.test(text)) {
    return {status: 'unreachable', reason: 'Klasör sayfası bulunamadı. Bağlantı hatalı veya içerik kaldırılmış olabilir.'};
  }
  // These are actual folder-listing elements, rather than a generic Google Drive
  // title/bootstrap script. Unknown/new viewer layouts deliberately do not pass.
  const driveTitle = /<title\b[^>]*>[^<]*Google Drive[^<]*<\/title>/i.test(html);
  const listing = /<div\b[^>]*class=["'][^"']*\bflip-entries\b[^"']*["'][^>]*>/i.test(html);
  const entry = /<div\b[^>]*class=["'][^"']*\bflip-entry-title\b[^"']*["'][^>]*>/i.test(html);
  if (status === 200 && driveTitle && listing && entry) {
    return {status: 'verified', reason: 'Anonim klasör görüntüleyicisi bir içerik listesi gösterdi. Dosya indirme, doğru dosyalar ve STL geometrisi doğrulanmadı.'};
  }
  return {status: 'unknown', reason: 'Sayfa yanıtı müşteri erişimini güvenilir biçimde kanıtlamadı. HTTP yanıtı tek başına başarılı teslim sayılmaz.'};
}

async function readHtml(response, limit, until) {
  const length = Number(headersValue(response, 'content-length'));
  if (length > limit) {
    cancelBody(response);
    throw Object.assign(new Error('body-limit'), {kind: 'body-limit'});
  }
  // Native fetch responses provide a readable stream. Refuse unbounded text().
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw Object.assign(new Error('no-bounded-body'), {kind: 'body-limit'});
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const part = await until(reader.read());
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw Object.assign(new Error('body-limit'), {kind: 'body-limit'});
      chunks.push(part.value);
    }
  } catch (error) {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (_) {}
    throw error;
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
}

function createChecker(defaults = {}) {
  const cache = new Map();

  return async function checkFolder(value, options = {}) {
    const parsed = folderUrl(value);
    const clock = options.now ?? defaults.now ?? Date.now;
    const stamp = typeof clock === 'function' ? Number(clock()) : Number(clock);
    if (!Number.isFinite(stamp)) throw new Error('Kontrol tarihi geçersiz.');
    const key = parsed.url;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > stamp) return {...cached.value, cached: true};
    const fetchImpl = options.fetchImpl || defaults.fetchImpl || globalThis.fetch;
    const timeout = Math.max(1, Math.min(15000, Number(options.timeoutMs || defaults.timeoutMs) || TIMEOUT_MS));
    const limit = Math.max(1, Math.min(MAX_BYTES, Number(options.maxBytes || defaults.maxBytes) || MAX_BYTES));
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error('timeout'), {kind: 'timeout'}));
      }, timeout);
    });
    const until = promise => Promise.race([promise, deadline]);
    const base = {
      checkedAt: new Date(stamp).toISOString(), method: 'anonymous-html',
      scope: 'folder-page-only', contentCheck: 'not-tested', geometryCheck: 'not-tested',
      httpStatus: null, cached: false
    };
    let result;
    let current = parsed.url;
    let response;
    let redirects = 0;
    try {
      while (true) {
        response = await until(fetchImpl(current, {
          method: 'GET', redirect: 'manual', credentials: 'omit',
          referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: {accept: 'text/html, application/xhtml+xml'}
        }));
        const status = Number(response.status);
        base.httpStatus = Number.isInteger(status) ? status : null;
        // A transport that ignored manual redirects cannot provide safe evidence.
        if (response.redirected) {
          cancelBody(response);
          result = {status: 'unknown', reason: 'İstek denetlenmeyen bir yönlendirme izledi. Erişim doğrulanmadı.'};
          break;
        }
        if ([301, 302, 303, 307, 308].includes(status)) {
          cancelBody(response);
          if (redirects++ >= MAX_REDIRECTS) {
            result = {status: 'unknown', reason: 'Yönlendirme sınırı aşıldı. Erişim doğrulanmadı.'};
            break;
          }
          let destination;
          try {
            const location = headersValue(response, 'location');
            if (!location) throw new Error('missing-location');
            destination = new URL(location, current);
          }
          catch (_) {
            result = {status: 'unknown', reason: 'Yönlendirme adresi geçersiz. Erişim doğrulanmadı.'};
            break;
          }
          if (destination.protocol !== 'https:' || destination.username || destination.password
            || destination.port || !REDIRECT_HOSTS.has(destination.hostname)) {
            result = {status: 'unknown', reason: 'Güvenli Google adresleri dışındaki yönlendirme izlenmedi.'};
            break;
          }
          if (destination.hostname === 'accounts.google.com') {
            result = {status: 'permission', reason: 'Anonim istek Google oturum açma sayfasına yönlendirildi. Müşteri erişimi doğrulanmadı.'};
            break;
          }
          let next;
          try { next = folderUrl(destination.href); } catch (_) {}
          if (!next || next.folderId !== parsed.folderId
            || (next.resourceKey && next.resourceKey !== parsed.resourceKey)) {
            result = {status: 'unknown', reason: 'Aynı klasör sayfası dışındaki yönlendirme izlenmedi. Dosya indirilmedi.'};
            break;
          }
          // Preserve a resource key if Google omits it from a canonical redirect.
          if (parsed.resourceKey && !next.resourceKey) {
            const preserved = new URL(next.url);
            preserved.searchParams.set('resourcekey', parsed.resourceKey);
            current = preserved.href;
          } else current = next.url;
          continue;
        }
        if (status === 429) {
          cancelBody(response);
          result = {status: 'unknown', reason: 'Google istek sınırı bildirdi. Otomatik tekrar denenmedi; kontrol beklemeye alındı.',
            retryAfterSeconds: retrySeconds(headersValue(response, 'retry-after'), stamp)};
          break;
        }
        if (status === 401) {
          cancelBody(response);
          result = {status: 'permission', reason: 'Anonim istek kimlik doğrulama gerektiriyor. Müşteri erişimi doğrulanmadı.'};
          break;
        }
        if (status >= 500 || status === 404 || status === 410) {
          cancelBody(response);
          result = status >= 500
            ? {status: 'unreachable', reason: 'Klasör hizmetine şu anda ulaşılamıyor. Paylaşım izni hakkında sonuç çıkarılamaz.'}
            : {status: 'unreachable', reason: 'Klasör sayfası bulunamadı. Bağlantı veya içerik kullanıcı tarafından kontrol edilmeli.'};
          break;
        }
        if (!/^text\/html(?:\s*;|$)|^application\/xhtml\+xml(?:\s*;|$)/i.test(headersValue(response, 'content-type'))) {
          cancelBody(response);
          result = {status: 'unknown', reason: 'Yanıt bir HTML klasör sayfası değil. Dosya içeriği indirilmedi.'};
          break;
        }
        result = inspectHtml(await readHtml(response, limit, until), status);
        break;
      }
    } catch (error) {
      // Never include a transport error or requested URL: it may contain resourcekey.
      result = error && error.kind === 'body-limit'
        ? {status: 'unknown', reason: 'Sayfa güvenli okuma sınırında incelenemedi. Klasör içeriği indirilmedi.'}
        : {status: 'unreachable', reason: error && (error.kind === 'timeout' || error.name === 'AbortError')
          ? 'Anonim kontrolün süre sınırı doldu. Paylaşım izni hakkında sonuç çıkarılamaz.'
          : 'Anonim kontrol sırasında ağ bağlantısı kurulamadı. Paylaşım izni hakkında sonuç çıkarılamaz.'};
    } finally {
      clearTimeout(timer);
    }
    const outcome = {...base, ...result};
    const ttl = Math.max(CACHE_MS, (outcome.retryAfterSeconds || 0) * 1000);
    cache.delete(key);
    cache.set(key, {value: outcome, expiresAt: stamp + ttl});
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return outcome;
  };
}

const checkFolder = createChecker();
module.exports = {checkFolder, createChecker};
