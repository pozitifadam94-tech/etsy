// Creates a self-contained, verified local release without copying user data.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawn, execFileSync} = require('node:child_process');

const REQUIRED_FILES = [
  'server.js', 'etsy.js', 'pinterest.js', 'pinterest-client.js', 'pinterest-store.js', 'pinterest-media.js', 'workspace.js', 'history.js', 'observations.js',
  'market.js', 'updates.js', 'workspace-api.js', 'package.json', 'README.md',
  'WINDOWS.md', 'RUN_LATEST.md', 'UPGRADE_STATUS.md', 'NEXT_STEPS.md',
  'windows-start.cmd', 'windows-shortcut.cmd', 'scripts/launch.js'
];
const OPTIONAL_FILES = ['drive-check.js', 'ROADMAP.md', 'REVIEW.md', 'RESEARCH_SOURCES.md', 'PINTEREST_SOURCES.md'];
const ASSET_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2']);
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 500;
const crcTable = Array.from({length: 256}, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safeName(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':') || name.includes('\0') || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Güvenli olmayan paket yolu.');
  }
  if (Buffer.byteLength(name) > 65535) throw new Error('Paket yolu çok uzun.');
  return name;
}

function normalizeEntries(entries) {
  const names = new Set();
  let bytes = 0;
  if (!Array.isArray(entries) || entries.length > MAX_FILES) throw new Error('Paket dosya sınırı aşıldı.');
  return entries.map(entry => {
    const name = safeName(entry.name);
    if (names.has(name)) throw new Error('Tekrarlanan paket yolu: ' + name);
    names.add(name);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    bytes += data.length;
    if (bytes > MAX_BYTES) throw new Error('Paket boyut sınırı aşıldı (25 MiB).');
    return {name, data};
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// ZIP STORE uses no external program or npm package. A fixed date makes equal
// inputs byte-for-byte equal. UTF-8 flags preserve Turkish filenames.
function writeZip(entries) {
  entries = normalizeEntries(entries);
  const local = [], central = [];
  let offset = 0;
  const fixedDosDate = (40 << 9) | (1 << 5) | 1; // 2020-01-01
  for (const {name, data} of entries) {
    const filename = Buffer.from(name);
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(fixedDosDate, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(fixedDosDate, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function verifyZip(zip) {
  if (!Buffer.isBuffer(zip) || zip.length < 22 || zip.length > MAX_BYTES + 1024 * 1024) throw new Error('Geçersiz ZIP boyutu.');
  const end = zip.length - 22;
  if (zip.readUInt32LE(end) !== 0x06054b50 || zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6) || zip.readUInt16LE(end + 20)) throw new Error('Geçersiz ZIP son kaydı.');
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const directorySize = zip.readUInt32LE(end + 12);
  if (count > MAX_FILES || zip.readUInt16LE(end + 8) !== count || cursor + directorySize !== end) throw new Error('Geçersiz ZIP dizini.');
  const entries = [], names = new Set();
  let localEnd = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Geçersiz ZIP dosya kaydı.');
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || zip.readUInt16LE(cursor + 10) !== 0 || zip.readUInt16LE(cursor + 8) !== 0x0800) throw new Error('Desteklenmeyen ZIP kaydı.');
    const name = safeName(zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    if (names.has(name)) throw new Error('Tekrarlanan ZIP yolu.');
    names.add(name);
    const offset = zip.readUInt32LE(cursor + 42), size = zip.readUInt32LE(cursor + 24), checksum = zip.readUInt32LE(cursor + 16);
    if (offset !== localEnd || offset + 30 > zip.readUInt32LE(end + 16) || zip.readUInt32LE(offset) !== 0x04034b50) throw new Error('Geçersiz yerel ZIP kaydı.');
    const localNameLength = zip.readUInt16LE(offset + 26), localExtraLength = zip.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + localNameLength + localExtraLength;
    if (localExtraLength || dataStart + size > zip.readUInt32LE(end + 16) || zip.readUInt16LE(offset + 6) !== 0x0800 || zip.readUInt16LE(offset + 8) !== 0 || zip.readUInt32LE(offset + 14) !== checksum || zip.readUInt32LE(offset + 18) !== size || zip.readUInt32LE(offset + 22) !== size || zip.readUInt32LE(cursor + 20) !== size) throw new Error('Tutarsız ZIP kaydı.');
    if (zip.subarray(offset + 30, dataStart).toString('utf8') !== name) throw new Error('ZIP dosya adı uyuşmuyor.');
    const data = zip.subarray(dataStart, dataStart + size);
    if (crc32(data) !== checksum) throw new Error('ZIP içerik sağlama toplamı uyuşmuyor.');
    entries.push({name, data});
    localEnd = dataStart + size;
    cursor = next;
  }
  if (cursor !== end || localEnd !== zip.readUInt32LE(end + 16)) throw new Error('ZIP sınırları uyuşmuyor.');
  return entries;
}

async function isPresent(filename) {
  try { await fsp.lstat(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function excludedAsset(name) {
  return name.split('/').some(part => part.startsWith('.') || /^(?:node_modules|dist|data|fixtures?|testfixtures|tests?|backups?|recovery)$/i.test(part)) || /(?:\.test\.|(?:^|\/)(?:connection|workspace|credentials?|secrets?|tokens?)(?:\.|$))/i.test(name);
}

async function collectFiles(source) {
  const files = [...REQUIRED_FILES];
  for (const name of OPTIONAL_FILES) if (await isPresent(path.join(source, name))) files.push(name);
  async function walk(relative) {
    const directory = path.join(source, relative);
    const stat = await fsp.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Paket varlık dizini gerçek bir klasör olmalı.');
    for (const item of await fsp.readdir(directory, {withFileTypes: true})) {
      const name = relative + '/' + item.name;
      if (excludedAsset(name)) continue;
      if (item.isSymbolicLink()) throw new Error('Sembolik bağlantı pakete alınamaz: ' + name);
      if (item.isDirectory()) await walk(name);
      else if (item.isFile() && ASSET_EXTENSIONS.has(path.extname(item.name).toLowerCase())) files.push(name);
    }
  }
  await walk('public');
  if (!files.includes('public/index.html')) throw new Error('Paketin ana sayfası bulunamadı.');
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    let timer;
    const done = () => { clearTimeout(timer); resolve(); };
    child.once('close', done);
    child.kill('SIGTERM');
    timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  });
}

async function smokePackage(directory, version, assets) {
  const dataDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'stl-package-smoke-'));
  const env = {...process.env, STL_DATA_DIR: dataDirectory, PORT: '0', HOST: '127.0.0.1', OPEN_BROWSER: '0'};
  delete env.NODE_OPTIONS;
  const child = spawn(process.execPath, [path.join(directory, 'server.js')], {cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => finish(new Error('Paket sunucusu zamanında başlamadı.')), 10000);
      const finish = (error, value) => { clearTimeout(timer); child.off('error', failed); child.off('exit', exited); error ? reject(error) : resolve(value); };
      const failed = () => finish(new Error('Paket sunucusu başlatılamadı.'));
      const exited = () => finish(new Error('Paket sunucusu sağlık kontrolünden önce kapandı.'));
      child.once('error', failed);
      child.once('exit', exited);
      child.stderr.on('data', () => {}); // Never emit potentially sensitive child diagnostics.
      child.stdout.on('data', chunk => {
        output = (output + chunk.toString()).slice(-4096);
        const found = output.match(/port\s+(\d+)/);
        if (found) finish(null, Number(found[1]));
      });
    });
    const base = 'http://127.0.0.1:' + port;
    const health = await fetch(base + '/api/health', {signal: AbortSignal.timeout(5000)});
    if (!health.ok) throw new Error('Paket sağlık kontrolü başarısız.');
    const status = await health.json();
    if (status.app !== 'stl-atelier' || status.version !== version) throw new Error('Paket sürümü/uygulaması sağlık kontrolüyle uyuşmuyor.');
    const page = await fetch(base + '/', {signal: AbortSignal.timeout(5000)});
    if (!page.ok || !(await page.text()).includes('<html')) throw new Error('Paket ana sayfası açılamadı.');
    for (const asset of assets.filter(name => /\.(?:js|css)$/.test(name))) {
      const response = await fetch(base + '/' + asset.slice('public/'.length), {signal: AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error('Paket varlığı sunulamıyor: ' + asset);
      await response.arrayBuffer();
    }
  } finally {
    await stopChild(child);
    await fsp.rm(dataDirectory, {recursive: true, force: true});
  }
}

async function validatePackage(directory, version, files) {
  for (const name of files.filter(name => name.endsWith('.js'))) {
    try { execFileSync(process.execPath, ['--check', path.join(directory, name)], {stdio: 'pipe', timeout: 10000}); }
    catch { throw new Error('Paket JavaScript kontrolü başarısız: ' + name); }
  }
  const html = await fsp.readFile(path.join(directory, 'public/index.html'), 'utf8');
  const references = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|\/\/|data:)/i.test(reference)) throw new Error('Paket ana sayfası dış varlığa bağımlı: ' + reference);
    const relative = reference.replace(/^\//, '').split(/[?#]/)[0];
    safeName(relative);
    if (!files.includes('public/' + relative)) throw new Error('Paket ana sayfasında eksik varlık: ' + reference);
  }
  await smokePackage(directory, version, files.filter(name => name.startsWith('public/')));
}

async function buildPackage({source = path.resolve(__dirname, '..'), dist = path.join(source, 'dist')} = {}) {
  source = path.resolve(source);
  dist = path.resolve(dist);
  if (dist === source) throw new Error('Dağıtım klasörü kaynak klasörü olamaz.');
  await fsp.mkdir(dist, {recursive: true});
  const distStat = await fsp.lstat(dist);
  if (!distStat.isDirectory() || distStat.isSymbolicLink()) throw new Error('Dağıtım konumu gerçek bir klasör olmalı.');
  const candidate = await fsp.mkdtemp(path.join(dist, '.candidate-'));
  try {
    const directory = path.join(candidate, 'application');
    await fsp.mkdir(directory);
    const files = await collectFiles(source);
    const realSource = await fsp.realpath(source);
    const entries = [], hashes = {};
    for (const name of files) {
      safeName(name);
      const filename = path.join(source, name);
      const stat = await fsp.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Paket kaynağı normal dosya olmalı: ' + name);
      const realFile = await fsp.realpath(filename);
      if (!realFile.startsWith(realSource + path.sep)) throw new Error('Paket kaynağı klasör dışında: ' + name);
      const data = await fsp.readFile(filename);
      entries.push({name, data});
      normalizeEntries(entries);
      hashes[name] = crypto.createHash('sha256').update(data).digest('hex');
      const target = path.join(directory, name);
      await fsp.mkdir(path.dirname(target), {recursive: true});
      await fsp.writeFile(target, data);
    }
    const metadata = JSON.parse(entries.find(entry => entry.name === 'package.json').data.toString());
    const version = metadata.version;
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Geçerli paket sürümü bulunamadı.');
    const manifest = Buffer.from(JSON.stringify({format: 1, application: 'stl-atelier', version, files: hashes}, null, 2) + '\n');
    entries.push({name: 'PACKAGE_MANIFEST.json', data: manifest});
    await fsp.writeFile(path.join(directory, 'PACKAGE_MANIFEST.json'), manifest);
    await validatePackage(directory, version, files);
    const zip = writeZip(entries);
    const verified = verifyZip(zip);
    if (verified.length !== entries.length || verified.some(entry => !entry.data.equals(entries.find(original => original.name === entry.name).data))) throw new Error('ZIP doğrulaması kaynaklarla uyuşmuyor.');
    const candidateZip = path.join(candidate, 'release.zip');
    await fsp.writeFile(candidateZip, zip);
    const zipPath = path.join(dist, 'STL-Atolyesi-' + version + '.zip');
    const latest = path.join(dist, 'latest');
    const suffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    let previous = null, previousZip = null, publishedDirectory = false, publishedZip = false;
    if (await isPresent(latest)) {
      const stat = await fsp.lstat(latest);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Mevcut latest gerçek bir klasör olmalı; değiştirilmedi.');
    }
    if (await isPresent(zipPath)) {
      const stat = await fsp.lstat(zipPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Mevcut sürüm ZIP konumu güvenli değil; değiştirilmedi.');
    }
    try {
      if (await isPresent(zipPath)) { const destination = path.join(dist, 'previous-' + version + '-' + suffix + '.zip'); await fsp.rename(zipPath, destination); previousZip = destination; }
      if (await isPresent(latest)) { const destination = path.join(dist, 'previous-' + suffix); await fsp.rename(latest, destination); previous = destination; }
      await fsp.rename(candidateZip, zipPath);
      publishedZip = true;
      await fsp.rename(directory, latest);
      publishedDirectory = true;
    } catch (error) {
      if (publishedDirectory) await fsp.rename(latest, directory);
      if (publishedZip) await fsp.rename(zipPath, candidateZip);
      if (previous) await fsp.rename(previous, latest);
      if (previousZip) await fsp.rename(previousZip, zipPath);
      throw error;
    }
    return {version, latest, zip: zipPath, previous, previousZip, files: entries.length, bytes: zip.length, checks: ['JavaScript sözdizimi', 'HTML yerel varlıkları', 'İzole temiz başlangıç ve sağlık', 'Sunulan JS/CSS dosyaları', 'ZIP yolları ve CRC32']};
  } finally {
    // Only this invocation's temporary candidate is removed; previous releases
    // and user folders are never recursively removed.
    await fsp.rm(candidate, {recursive: true, force: true});
  }
}

if (require.main === module) buildPackage().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {console.error('Paket oluşturulmadı: ' + error.message); process.exitCode = 1;});
module.exports = {buildPackage, writeZip, verifyZip, crc32};
