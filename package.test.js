const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {buildPackage, writeZip, verifyZip, crc32} = require('./scripts/package');

test('ZIP stores UTF-8 names deterministically and verifies independent CRC32 value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = [{name: 'public/şekil.js', data: Buffer.from('merhaba')}, {name: 'README.md', data: Buffer.from('yerel')}];
  const first = writeZip(entries);
  assert.deepEqual(first, writeZip(entries.slice().reverse()));
  const decoded = verifyZip(first);
  assert.deepEqual(decoded.map(entry => entry.name), ['public/şekil.js', 'README.md']);
  assert.equal(decoded[0].data.toString(), 'merhaba');
  const damaged = Buffer.from(first);
  damaged[30 + Buffer.byteLength('public/şekil.js')] ^= 1;
  assert.throws(() => verifyZip(damaged), /sağlama toplamı/);
});

test('ZIP rejects traversal, ambiguous names and duplicates before writing', () => {
  for (const name of ['../secret', '/secret', 'C:/secret', 'public\\secret', 'public//secret', 'public/./secret', 'public/../secret', 'secret\0.js']) {
    assert.throws(() => writeZip([{name, data: Buffer.alloc(0)}]), /olmayan/);
  }
  assert.throws(() => writeZip([{name: 'x.js', data: 'a'}, {name: 'x.js', data: 'b'}]), /Tekrarlanan/);
});

async function fixture(root) {
  const names = ['pinterest.js', 'pinterest-client.js', 'pinterest-store.js', 'pinterest-media.js', 'etsy.js', 'workspace.js', 'history.js', 'observations.js', 'market.js', 'updates.js', 'workspace-api.js', 'README.md', 'WINDOWS.md', 'RUN_LATEST.md', 'UPGRADE_STATUS.md', 'NEXT_STEPS.md', 'windows-start.cmd', 'windows-shortcut.cmd', 'scripts/launch.js'];
  for (const name of names) {
    const filename = path.join(root, name);
    await fs.mkdir(path.dirname(filename), {recursive: true});
    await fs.writeFile(filename, name.endsWith('.js') ? 'module.exports = {};\n' : 'Temsili paket belgesi\n');
  }
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({name: 'fixture', version: '1.6.0'}));
  await fs.writeFile(path.join(root, 'server.js'), `const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const server=http.createServer((req,res)=>{if(req.url==='/api/health'){res.end(JSON.stringify({app:'stl-atelier',version:require('./package.json').version}));return;}const name=req.url==='/'?'index.html':req.url.slice(1);try{res.end(fs.readFileSync(path.join(__dirname,'public',name)));}catch{res.writeHead(404);res.end();}});server.listen(Number(process.env.PORT),process.env.HOST,()=>console.log('port '+server.address().port));\n`);
  await fs.mkdir(path.join(root, 'public'), {recursive: true});
  await fs.writeFile(path.join(root, 'public/index.html'), '<html><link rel="stylesheet" href="style.css"><script src="app.js"></script></html>');
  await fs.writeFile(path.join(root, 'public/style.css'), 'body{}');
  await fs.writeFile(path.join(root, 'public/app.js'), 'console.log("fixture");');
}

test('verified package excludes private data and preserves latest when a new candidate fails', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stl-package-test-'));
  try {
    const source = path.join(directory, 'source');
    await fs.mkdir(source);
    await fixture(source);
    await fs.writeFile(path.join(source, '.env'), 'THIS_MUST_NOT_SHIP=1');
    await fs.writeFile(path.join(source, 'connection.json'), '{"token":"THIS_MUST_NOT_SHIP"}');
    await fs.mkdir(path.join(source, 'public/testfixtures'));
    await fs.writeFile(path.join(source, 'public/testfixtures/customer.js'), 'THIS_MUST_NOT_SHIP');
    await fs.writeFile(path.join(source, 'public/workspace.json'), '{"customer":"THIS_MUST_NOT_SHIP"}');
    const first = await buildPackage({source});
    const firstArchive = await fs.readFile(first.zip);
    assert.equal(first.previous, null);
    assert.equal(firstArchive.includes(Buffer.from('THIS_MUST_NOT_SHIP')), false);
    const names = verifyZip(firstArchive).map(entry => entry.name);
    assert(names.includes('PACKAGE_MANIFEST.json'));
    assert(names.includes('scripts/launch.js'));
    assert(!names.some(name => /testfixtures|connection|workspace\.json|\.env/.test(name)));
    await fs.writeFile(path.join(source, 'public/app.js'), 'this is invalid JavaScript ???');
    await assert.rejects(buildPackage({source}), /JavaScript kontrolü/);
    assert.deepEqual(await fs.readFile(first.zip), firstArchive);
    assert.equal(await fs.readFile(path.join(first.latest, 'public/app.js'), 'utf8'), 'console.log("fixture");');
    assert(!(await fs.readdir(path.dirname(first.latest))).some(name => name.startsWith('.candidate-')));
    await fs.writeFile(path.join(source, 'public/app.js'), 'console.log("second");');
    const second = await buildPackage({source});
    assert(second.previous);
    assert(second.previousZip);
    assert.equal(await fs.readFile(path.join(second.previous, 'public/app.js'), 'utf8'), 'console.log("fixture");');
    assert.deepEqual(await fs.readFile(second.previousZip), firstArchive);
    assert.equal(await fs.readFile(path.join(second.latest, 'public/app.js'), 'utf8'), 'console.log("second");');
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
});
