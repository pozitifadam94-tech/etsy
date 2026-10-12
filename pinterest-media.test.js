'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {Readable, PassThrough} = require('node:stream');
const {createHash} = require('node:crypto');
const {createMediaFetcher} = require('./pinterest-media');

// Actual small JPEG/PNG fixture bytes, generated locally once. No network is
// used by this suite and no user image is edited or regenerated.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFUlEQVQI12O8G2rMwMDAwMDAxAADABoAAWlsnNFmAAAAAElFTkSuQmCC', 'base64');
// Verified 5×3 JPEG fixture. The prior fixture contained nine stray bytes in
// its quantization table and a strict container check correctly rejected it.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAADAAUDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAABP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AIQAu/9k=', 'base64');
const SOURCE = 'https://i.etsystatic.com/123/r/il/abc/il_fullxfull.456.jpg';
const PUBLIC_V4 = '23.33.42.51';
const PUBLIC_V6 = '2600:1408:ec00:36::1736:7f31';

function fixture({data = PNG, status = 200, headers = {}, chunks, socket} = {}) {
  const response = Readable.from(chunks || [data], {objectMode: false});
  response.statusCode = status;
  response.headers = {'content-type': 'image/png', ...headers};
  if (socket) response.socket = socket;
  return response;
}

function fakeTransport(responses = [fixture()], options = {}) {
  const calls = [];
  const requests = [];
  const pending = [...responses];
  const requestImpl = (url, config, callback) => {
    calls.push({url: String(url), config});
    const request = new EventEmitter();
    request.destroyed = false;
    request.destroy = () => { request.destroyed = true; };
    request.end = () => {
      const response = pending.shift();
      if (!response) return;
      const deliver = () => callback(response);
      if (options.delayMs) setTimeout(deliver, options.delayMs);
      else queueMicrotask(deliver);
    };
    requests.push(request);
    return request;
  };
  return {requestImpl, calls, requests};
}

function lookupRecords(records = [{address: PUBLIC_V4, family: 4}]) {
  const calls = [];
  const lookup = (hostname, options, callback) => {
    calls.push({hostname, options});
    queueMicrotask(() => callback(null, records));
  };
  return {lookup, calls};
}

function setup(responses, options = {}) {
  const transport = fakeTransport(responses);
  const resolver = lookupRecords();
  const fetchImage = createMediaFetcher({lookup: resolver.lookup, requestImpl: transport.requestImpl, ...options});
  return {fetchImage, transport, resolver};
}

async function rejectsImage(operation, code) {
  await assert.rejects(operation, error => error.kind === 'image' && error.code === code);
}

test('original PNG bytes, source ratio, length and SHA256 reach the pin media unchanged', async () => {
  const parts = [PNG.subarray(0, 1), PNG.subarray(1, 18), PNG.subarray(18)];
  const {fetchImage} = setup([fixture({chunks: parts, headers: {'content-length': String(PNG.length)}})]);
  const result = await fetchImage(SOURCE);
  assert.deepEqual(result.data, PNG);
  assert.equal(result.content_type, 'image/png');
  assert.equal(result.bytes, PNG.length);
  assert.equal(result.sha256, createHash('sha256').update(PNG).digest('hex'));
  assert.equal(result.width, 3);
  assert.equal(result.height, 2);
  assert.deepEqual(Buffer.from(result.data.toString('base64'), 'base64'), PNG);
});

test('JPEG source remains JPEG with its original landscape dimensions and bytes', async () => {
  const {fetchImage} = setup([fixture({data: JPEG, headers: {'content-type': 'image/jpeg; charset=binary'}})]);
  const image = await fetchImage(SOURCE);
  assert.equal(image.content_type, 'image/jpeg');
  assert.equal(image.width, 5);
  assert.equal(image.height, 3);
  assert.equal(image.sha256, createHash('sha256').update(JPEG).digest('hex'));
  assert.deepEqual(image.data, JPEG);
});

test('URL validation blocks foreign CDN, Drive, credentials, HTTP and special addresses before any DNS or request', async () => {
  const {fetchImage, transport, resolver} = setup();
  for (const url of [
    'http://i.etsystatic.com/a.jpg', 'https://drive.google.com/file/d/private/view',
    'https://etsy.com/a.jpg', 'https://etsystatic.com.evil.example/a.jpg',
    'https://eviletsystatic.com/a.jpg', 'https://i.etsystatic.com./a.jpg',
    'https://user:secret@i.etsystatic.com/a.jpg', 'https://i.etsystatic.com:444/a.jpg',
    'https://i.etsystatic.com/a.jpg#fragment', 'https://127.0.0.1/a.jpg',
    'https://2130706433/a.jpg', 'https://[::1]/a.jpg', 'https://[::ffff:127.0.0.1]/a.jpg',
    'https://i.etsystatic.com\\@127.0.0.1/a.jpg', 'https://i.etsystatic.com/a\n.jpg',
    null, 23, '', SOURCE + 'x'.repeat(4096)
  ]) await rejectsImage(() => fetchImage(url), 'url');
  assert.equal(resolver.calls.length, 0);
  assert.equal(transport.calls.length, 0);
});

test('all DNS answers must be public, covering IPv4 and IPv6 private/reserved bypasses', async () => {
  const forbidden = [
    '0.0.0.0', '10.0.0.1', '127.0.0.1', '100.64.0.1', '100.127.255.255',
    '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1',
    '192.0.0.5', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.19.255.255',
    '198.51.100.4', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', 'fe80::1', 'fc00::1', 'fd00::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a00:1',
    '2001:db8::1', '2001::1234', '2001:2::1', '2002:7f00:1::1', '3fff::1'
  ];
  for (const address of forbidden) {
    const transport = fakeTransport();
    const records = [{address: PUBLIC_V4, family: 4}, {address, family: address.includes(':') ? 6 : 4}];
    const fetchImage = createMediaFetcher({lookup: lookupRecords(records).lookup, requestImpl: transport.requestImpl});
    await rejectsImage(() => fetchImage(SOURCE), 'dns');
    assert.equal(transport.calls.length, 0, address);
  }
});

test('missing, malformed, mismatched or failed DNS answers never reach the transport', async () => {
  for (const records of [[], [null], [{address: 'not-an-ip', family: 4}], [{address: PUBLIC_V4, family: 6}]]) {
    const transport = fakeTransport();
    const fetchImage = createMediaFetcher({lookup: lookupRecords(records).lookup, requestImpl: transport.requestImpl});
    await rejectsImage(() => fetchImage(SOURCE), 'dns');
    assert.equal(transport.calls.length, 0);
  }
  const {fetchImage, transport} = setup(undefined, {lookup: (host, options, callback) => callback(new Error('private DNS credentials'))});
  await assert.rejects(() => fetchImage(SOURCE), error => error.code === 'dns' && !error.message.includes('credentials'));
  assert.equal(transport.calls.length, 0);
});

test('native verified HTTPS options omit auth/cookies, disable pooling and pin both address families', async () => {
  const records = [{address: PUBLIC_V4, family: 4}, {address: PUBLIC_V6, family: 6}];
  const transport = fakeTransport();
  let lookups = 0;
  const lookup = (host, options, callback) => {
    lookups++;
    assert.deepEqual(options, {all: true, verbatim: true});
    callback(null, records);
  };
  await createMediaFetcher({lookup, requestImpl: transport.requestImpl})(SOURCE);
  const options = transport.calls[0].config;
  assert.equal(options.method, 'GET');
  assert.equal(options.agent, false);
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.servername, 'i.etsystatic.com');
  assert.deepEqual(options.headers, {accept: 'image/jpeg, image/png', 'accept-encoding': 'identity'});
  assert.equal(options.signal instanceof AbortSignal, true);
  const pinned = (host, config) => new Promise((resolve, reject) => options.lookup(host, config, (error, ...answer) => error ? reject(error) : resolve(answer)));
  assert.deepEqual(await pinned('i.etsystatic.com', {}), [PUBLIC_V4, 4]);
  assert.deepEqual(await pinned('i.etsystatic.com', {all: true}), [records]);
  assert.deepEqual(await pinned('i.etsystatic.com', {family: 6}), [PUBLIC_V6, 6]);
  await rejectsImage(() => pinned('evil.example', {}), 'dns');
  records[0].address = '127.0.0.1';
  assert.deepEqual(await pinned('i.etsystatic.com', {}), [PUBLIC_V4, 4]);
  assert.equal(lookups, 1, 'connection never performs another DNS lookup that could rebind');
});

test('public IPv6 and Promise-style injectable DNS resolve safely', async () => {
  const {fetchImage} = setup(undefined, {lookup: async () => [{address: PUBLIC_V6, family: 6}]});
  assert.deepEqual((await fetchImage(SOURCE)).data, PNG);
});

test('socket address mismatch and TLS failures reject the received image', async () => {
  for (const [socket, code] of [
    [{remoteAddress: '127.0.0.1', encrypted: true, authorized: true}, 'dns'],
    [{remoteAddress: '23.33.42.52', encrypted: true, authorized: true}, 'dns'],
    [{remoteAddress: PUBLIC_V4, encrypted: true, authorized: false}, 'tls'],
    [{remoteAddress: PUBLIC_V4, encrypted: false, authorized: true}, 'tls']
  ]) {
    const response = fixture({socket});
    const {fetchImage} = setup([response]);
    await rejectsImage(() => fetchImage(SOURCE), code);
    assert.equal(response.destroyed, true);
  }
  const {fetchImage} = setup([fixture({socket: {remoteAddress: '::ffff:' + PUBLIC_V4, encrypted: true, authorized: true}})]);
  assert.deepEqual((await fetchImage(SOURCE)).data, PNG);
});

test('bounded CDN redirects preserve bytes and validate DNS again at each step', async () => {
  const first = fixture({status: 302, headers: {location: '/next.png'}});
  const second = fixture({status: 307, headers: {location: 'https://img1.etsystatic.com/final.png'}});
  const {fetchImage, transport, resolver} = setup([first, second, fixture()]);
  const image = await fetchImage(SOURCE);
  assert.deepEqual(image.data, PNG);
  assert.equal(first.destroyed, true);
  assert.equal(second.destroyed, true);
  assert.deepEqual(transport.calls.map(call => call.url), [SOURCE, 'https://i.etsystatic.com/next.png', 'https://img1.etsystatic.com/final.png']);
  assert.deepEqual(resolver.calls.map(call => call.hostname), ['i.etsystatic.com', 'i.etsystatic.com', 'img1.etsystatic.com']);
});

test('foreign, Drive, downgrade, credentials and private redirects are never followed', async () => {
  for (const location of [
    'https://drive.google.com/file/d/private', 'https://evil.example/file.jpg',
    'https://i.etsystatic.com.evil.example/file.jpg', 'http://i.etsystatic.com/file.jpg',
    'https://user:secret@i.etsystatic.com/file.jpg', 'https://127.0.0.1/file.jpg',
    'https://[::1]/file.jpg', 'https://i.etsystatic.com:8443/file.jpg', '/file.jpg#bad'
  ]) {
    const response = fixture({status: 302, headers: {location}});
    const {fetchImage, transport, resolver} = setup([response]);
    await rejectsImage(() => fetchImage(SOURCE), 'redirect');
    assert.equal(transport.calls.length, 1);
    assert.equal(resolver.calls.length, 1);
    assert.equal(response.destroyed, true);
  }
});

test('redirects to CDN hostname resolving privately stop before the second request', async () => {
  let count = 0;
  const transport = fakeTransport([fixture({status: 302, headers: {location: '/next.png'}})]);
  const lookup = (hostname, options, callback) => callback(null, [{address: ++count === 1 ? PUBLIC_V4 : '10.0.0.5', family: 4}]);
  const fetchImage = createMediaFetcher({lookup, requestImpl: transport.requestImpl});
  await rejectsImage(() => fetchImage(SOURCE), 'dns');
  assert.equal(count, 2);
  assert.equal(transport.calls.length, 1);
});

test('three redirects are allowed; missing, looping and fourth redirects are blocked', async () => {
  const responses = [1, 2, 3].map(number => fixture({status: 301, headers: {location: '/hop' + number + '.png'}}));
  assert.deepEqual((await setup([...responses, fixture()]).fetchImage(SOURCE)).data, PNG);
  const fourth = [1, 2, 3, 4].map(number => fixture({status: 308, headers: {location: '/hop' + number + '.png'}}));
  const tooMany = setup(fourth);
  await rejectsImage(() => tooMany.fetchImage(SOURCE), 'redirect');
  assert.equal(tooMany.transport.calls.length, 4);
  for (const headers of [{}, {location: SOURCE}]) {
    const {fetchImage, transport} = setup([fixture({status: 302, headers})]);
    await rejectsImage(() => fetchImage(SOURCE), 'redirect');
    assert.equal(transport.calls.length, 1);
  }
});

test('WebP, text, missing MIME, compression and magic/MIME mismatch never convert or substitute another image', async () => {
  for (const headers of [
    {'content-type': 'image/webp'}, {'content-type': 'text/html'}, {'content-type': ''},
    {'content-type': 'image/png', 'content-encoding': 'gzip'}, {'content-type': ['image/png', 'text/html']}
  ]) {
    const {fetchImage, transport} = setup([fixture({headers})]);
    await rejectsImage(() => fetchImage(SOURCE), 'mime');
    assert.equal(transport.calls.length, 1);
  }
  for (const [data, mime] of [[PNG, 'image/jpeg'], [JPEG, 'image/png'], [Buffer.from('<html>private</html>'), 'image/png'], [Buffer.from('RIFF....WEBP'), 'image/jpeg']]) {
    const {fetchImage, transport} = setup([fixture({data, headers: {'content-type': mime}})]);
    await rejectsImage(() => fetchImage(SOURCE), 'magic');
    assert.equal(transport.calls.length, 1);
  }
});

test('damaged/truncated JPEG and PNG containers are rejected', async () => {
  const damagedPng = Buffer.from(PNG);
  damagedPng[damagedPng.length - 15] ^= 1;
  const damagedJpeg = Buffer.from(JPEG);
  damagedJpeg[damagedJpeg.length - 1] = 0;
  for (const [data, mime] of [
    [PNG.subarray(0, -1), 'image/png'], [damagedPng, 'image/png'],
    [Buffer.concat([PNG, Buffer.from('extra')]), 'image/png'],
    [JPEG.subarray(0, -2), 'image/jpeg'], [damagedJpeg, 'image/jpeg'],
    [Buffer.from([255, 216, 255, 217]), 'image/jpeg']
  ]) {
    const {fetchImage} = setup([fixture({data, headers: {'content-type': mime}})]);
    await rejectsImage(() => fetchImage(SOURCE), 'magic');
  }
});

test('declared oversize, empty or malformed lengths are rejected before reading the body', async () => {
  for (const length of ['1025', '0', '-1', 'garbage', '80,80', ['80', '80'], '999999999999999999999']) {
    const response = new PassThrough();
    response.statusCode = 200;
    response.headers = {'content-type': 'image/png', 'content-length': length};
    const {fetchImage} = setup([response], {maxBytes: 1024});
    await rejectsImage(() => fetchImage(SOURCE), 'size');
    assert.equal(response.destroyed, true);
  }
});

test('chunked streams cannot exceed the local byte bound or lie about Content-Length', async () => {
  for (const [response, options] of [
    [fixture({chunks: [PNG, Buffer.alloc(20)]}), {maxBytes: PNG.length + 1}],
    [fixture({headers: {'content-length': String(PNG.length - 1)}}), {}],
    [fixture({headers: {'content-length': String(PNG.length + 1)}}), {}],
    [fixture({data: Buffer.alloc(0)}), {}]
  ]) {
    await rejectsImage(() => setup([response], options).fetchImage(SOURCE), 'size');
    assert.equal(response.destroyed, true);
  }
});

test('guard cannot be raised above 8 MiB using configuration', async () => {
  const response = new PassThrough();
  response.statusCode = 200;
  response.headers = {'content-type': 'image/png', 'content-length': String(8 * 1024 * 1024 + 1)};
  await rejectsImage(() => setup([response], {maxBytes: 50 * 1024 * 1024}).fetchImage(SOURCE), 'size');
});

test('HTTP errors and partial content are item failures with safe messages', async () => {
  for (const status of [206, 401, 403, 404, 429, 500]) {
    const response = fixture({status, data: Buffer.from('oauth=private&cookie=private&deliveryFolderUrl=private')});
    const {fetchImage} = setup([response]);
    await assert.rejects(() => fetchImage(SOURCE), error => error.kind === 'image' && error.code === 'http'
      && error.status === status && !error.message.includes('private'));
    assert.equal(response.destroyed, true);
  }
});

test('hanging DNS is bounded by the same deadline and cannot start a late request', async () => {
  let complete;
  const {fetchImage, transport} = setup(undefined, {timeoutMs: 15, lookup: (host, options, callback) => { complete = callback; }});
  const started = Date.now();
  await rejectsImage(() => fetchImage(SOURCE), 'timeout');
  assert.ok(Date.now() - started < 1000);
  complete(null, [{address: PUBLIC_V4, family: 4}]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transport.calls.length, 0);
});

test('hanging response headers abort and destroy the outgoing request', async () => {
  const {fetchImage, transport} = setup([], {timeoutMs: 15});
  await rejectsImage(() => fetchImage(SOURCE), 'timeout');
  assert.equal(transport.calls[0].config.signal.aborted, true);
  assert.equal(transport.requests[0].destroyed, true);
});

test('hanging chunked body is aborted and destroyed, even when transport ignores AbortSignal', async () => {
  const response = new PassThrough();
  response.statusCode = 200;
  response.headers = {'content-type': 'image/png'};
  const {fetchImage, transport} = setup([response], {timeoutMs: 15});
  const operation = fetchImage(SOURCE);
  response.write(PNG.subarray(0, 12));
  await rejectsImage(() => operation, 'timeout');
  assert.equal(response.destroyed, true);
  assert.equal(transport.requests[0].destroyed, true);
  assert.equal(transport.calls[0].config.signal.aborted, true);
});

test('late response callback after deadline also destroys its response stream', async () => {
  const response = new PassThrough();
  response.statusCode = 200;
  response.headers = {'content-type': 'image/png'};
  const transport = fakeTransport([response], {delayMs: 25});
  const fetchImage = createMediaFetcher({lookup: lookupRecords().lookup, requestImpl: transport.requestImpl, timeoutMs: 10});
  await rejectsImage(() => fetchImage(SOURCE), 'timeout');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(response.destroyed, true);
});

test('stream cancellation, network errors and malformed transports fail without exposing provider details', async () => {
  const response = new PassThrough();
  response.statusCode = 200;
  response.headers = {'content-type': 'image/png'};
  const operation = setup([response]).fetchImage(SOURCE);
  await new Promise(resolve => setImmediate(resolve));
  response.destroy(new Error('token=private-cookie'));
  await assert.rejects(() => operation, error => error.code === 'network' && !error.message.includes('private'));
  const requestImpl = () => { throw new Error('oauth-private'); };
  await rejectsImage(() => createMediaFetcher({lookup: lookupRecords().lookup, requestImpl})(SOURCE), 'network');
  await rejectsImage(() => setup([{}]).fetchImage(SOURCE), 'network');
});
