'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createChecker} = require('./drive-check');
const FOLDER_ID = 'Folder_1234567890';
const URL = 'https://drive.google.com/drive/folders/' + FOLDER_ID;
const STAMP = Date.UTC(2026, 9, 10, 12);
const html = (body, status = 200, headers = {}) => new Response(body, {
  status, headers: {'content-type': 'text/html; charset=utf-8', ...headers}
});

test('HTTP 200 and a Google Drive title alone do not prove customer access', async () => {
  const check = createChecker({fetchImpl: async () => html('<title>Google Drive</title><p>Loading…</p>'), now: STAMP});
  const result = await check(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.scope, 'folder-page-only');
  assert.equal(result.method, 'anonymous-html');
  assert.equal(result.contentCheck, 'not-tested');
  assert.equal(result.geometryCheck, 'not-tested');
});

test('Anonymous folder-list evidence verifies only the folder page, never file downloads', async () => {
  const body = '<title>Models - Google Drive</title><div class="flip-entries"><div class="flip-entry-title">Model.stl</div></div>';
  const result = await createChecker({fetchImpl: async () => html(body), now: STAMP})(URL);
  assert.equal(result.status, 'verified');
  assert.match(result.reason, /Dosya indirme.*doğrulanmadı/);
  assert.equal(result.contentCheck, 'not-tested');
  assert.equal(result.geometryCheck, 'not-tested');
});

test('Folder-like strings in scripts or comments cannot count as viewer evidence', async () => {
  const body = '<title>Google Drive</title><script>var template = \'<div class="flip-entries"><div class="flip-entry-title">x</div></div>\';</script><!-- <div class="flip-entries"><div class="flip-entry-title">x</div></div> -->';
  const result = await createChecker({fetchImpl: async () => html(body), now: STAMP})(URL);
  assert.equal(result.status, 'unknown');
});

test('Explicit access request is distinct from generic gateway forbidden response', async () => {
  const permission = await createChecker({fetchImpl: async () => html('<title>Google Drive</title><h1>You need access</h1><button>Request access</button>', 403), now: STAMP})(URL);
  const gateway = await createChecker({fetchImpl: async () => html('<title>Gateway</title><h1>Access denied</h1>', 403), now: STAMP})(URL);
  assert.equal(permission.status, 'permission');
  assert.equal(gateway.status, 'unknown');
  assert.equal(gateway.httpStatus, 403);
});

test('CAPTCHA overrides apparent viewer/access markers without claiming a sharing problem', async () => {
  const result = await createChecker({fetchImpl: async () => html('<title>Google Drive</title><h1>Unusual traffic</h1><p>You need access</p>'), now: STAMP})(URL);
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /trafik engeli/);
});

test('A normal public-page sign-in link is not interpreted as required authentication', async () => {
  const body = '<title>Google Drive</title><a href="https://accounts.google.com/signin">Sign in</a><div class="flip-entries"><div class="flip-entry-title">Model.stl</div></div>';
  const result = await createChecker({fetchImpl: async () => html(body), now: STAMP})(URL);
  assert.equal(result.status, 'verified');
});

test('Only HTTPS exact Google Drive folder inputs are accepted; no fetch occurs for invalid inputs', async () => {
  let calls = 0;
  const check = createChecker({fetchImpl: async () => {calls++; return html('');}, now: STAMP});
  for (const input of [
    'http://drive.google.com/drive/folders/' + FOLDER_ID,
    'https://127.0.0.1/drive/folders/' + FOLDER_ID,
    'https://drive.google.com.evil.example/drive/folders/' + FOLDER_ID,
    'https://drive.google.com@127.0.0.1/drive/folders/' + FOLDER_ID,
    'https://owner:secret@drive.google.com/drive/folders/' + FOLDER_ID,
    'https://drive.google.com:444/drive/folders/' + FOLDER_ID,
    'https://drive.google.com/file/d/' + FOLDER_ID + '/view',
    'https://drive.google.com/uc?export=download&id=' + FOLDER_ID
  ]) await assert.rejects(() => check(input));
  assert.equal(calls, 0);
});

test('Request omits credentials and never includes authorization/cookie headers', async () => {
  let request;
  const check = createChecker({now: STAMP, fetchImpl: async (url, options) => {
    request = {url, options}; return html('Loading');
  }});
  await check(URL + '?usp=sharing&resourcekey=Key_123');
  assert.equal(request.url, URL + '?resourcekey=Key_123');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.redirect, 'manual');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.referrerPolicy, 'no-referrer');
  assert.deepEqual(Object.keys(request.options.headers), ['accept']);
});

test('Redirect to Google sign-in is reported without fetching the sign-in page', async () => {
  let calls = 0;
  const result = await createChecker({now: STAMP, fetchImpl: async () => {
    calls++; return new Response(null, {status: 302, headers: {location: 'https://accounts.google.com/ServiceLogin?continue=private'}});
  }})(URL);
  assert.equal(result.status, 'permission');
  assert.equal(calls, 1);
});

test('Redirects to other hosts, private addresses, files, or other folders are not fetched', async () => {
  for (const location of [
    'http://drive.google.com/drive/folders/' + FOLDER_ID,
    'https://127.0.0.1/', 'https://[::1]/', 'https://evil.example/',
    'https://drive.google.com.evil.example/', 'https://docs.google.com/',
    'https://user:pass@drive.google.com/drive/folders/' + FOLDER_ID,
    'https://drive.google.com/file/d/OtherFile_123/view',
    'https://drive.google.com/uc?export=download&id=' + FOLDER_ID,
    'https://drive.google.com/drive/folders/OtherFolder_12345',
    URL + '?resourcekey=different_key'
  ]) {
    let calls = 0;
    const result = await createChecker({now: STAMP, fetchImpl: async () => {
      calls++; return new Response(null, {status: 302, headers: {location}});
    }})(URL + '?resourcekey=original_key');
    assert.equal(result.status, 'unknown', location);
    assert.equal(calls, 1, location);
  }
});

test('A same-folder canonical redirect preserves the resource key', async () => {
  const requests = [];
  const result = await createChecker({now: STAMP, fetchImpl: async url => {
    requests.push(url);
    if (requests.length === 1) return new Response(null, {status: 302, headers: {location: '/drive/u/0/folders/' + FOLDER_ID}});
    return html('<title>Google Drive</title><p>Loading</p>');
  }})(URL + '?resourcekey=Key_123');
  assert.equal(result.status, 'unknown');
  assert.deepEqual(requests, [URL + '?resourcekey=Key_123', URL + '?resourcekey=Key_123']);
});

test('Redirect loops stop after the bounded redirect allowance', async () => {
  let calls = 0;
  const result = await createChecker({now: STAMP, fetchImpl: async () => {
    calls++; return new Response(null, {status: 302, headers: {location: URL}});
  }})(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(calls, 4);
});

test('A missing redirect location cannot trigger repeated requests', async () => {
  let calls = 0;
  const result = await createChecker({now: STAMP, fetchImpl: async () => {
    calls++; return new Response(null, {status: 302});
  }})(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(calls, 1);
});

test('A transport that auto-followed redirects does not produce evidence', async () => {
  const response = html('<title>Google Drive</title><div class="flip-entries"><div class="flip-entry-title">File</div></div>');
  Object.defineProperty(response, 'redirected', {value: true});
  const result = await createChecker({now: STAMP, fetchImpl: async () => response})(URL);
  assert.equal(result.status, 'unknown');
});

test('HTTP 429 is not retried, retry delay is bounded and extends the cache', async () => {
  let calls = 0, stamp = STAMP;
  const check = createChecker({now: () => stamp, fetchImpl: async () => {
    calls++; return new Response(null, {status: 429, headers: {'retry-after': '9999999999'}});
  }});
  const first = await check(URL);
  assert.equal(first.status, 'unknown');
  assert.equal(first.retryAfterSeconds, 3600);
  stamp += 20 * 60 * 1000;
  assert.equal((await check(URL)).cached, true);
  assert.equal(calls, 1);
});

test('Canonical URL cache lasts 10 minutes and distinguishes resource keys', async () => {
  let calls = 0, stamp = STAMP;
  const check = createChecker({now: () => stamp, fetchImpl: async () => {calls++; return html('Loading');}});
  const initial = await check(URL + '?resourcekey=KeyA&usp=sharing');
  stamp += 9 * 60 * 1000;
  const cached = await check(URL + '?usp=copy&resourcekey=KeyA');
  assert.equal(cached.cached, true);
  assert.equal(cached.checkedAt, initial.checkedAt);
  assert.equal(calls, 1);
  await check(URL + '?resourcekey=KeyB');
  assert.equal(calls, 2);
  stamp += 2 * 60 * 1000;
  assert.equal((await check(URL + '?resourcekey=KeyA')).cached, false);
  assert.equal(calls, 3);
});

test('Non-HTML responses are rejected without reading a file body', async () => {
  let reads = 0;
  const response = {status: 200, headers: new Headers({'content-type': 'application/octet-stream'}),
    body: {cancel() {}, getReader() {reads++; throw new Error('must not read');}}};
  const result = await createChecker({now: STAMP, fetchImpl: async () => response})(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(reads, 0);
});

test('Declared oversized HTML is not read and cannot yield success', async () => {
  let reads = 0;
  const response = {status: 200, headers: new Headers({'content-type': 'text/html', 'content-length': '9000000'}),
    body: {cancel() {}, getReader() {reads++; throw new Error('must not read');}}};
  const result = await createChecker({now: STAMP, fetchImpl: async () => response})(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(reads, 0);
});

test('Streamed oversized HTML is cancelled at the byte limit', async () => {
  let cancelled = false;
  const stream = new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(100));}, cancel() {cancelled = true;}});
  const result = await createChecker({now: STAMP, maxBytes: 40,
    fetchImpl: async () => new Response(stream, {headers: {'content-type': 'text/html'}})})(URL);
  assert.equal(result.status, 'unknown');
  assert.equal(cancelled, true);
});

test('Transport and body timeouts are bounded even when an injected fetch ignores abort', async () => {
  const stalledRequest = await createChecker({now: STAMP, timeoutMs: 10, fetchImpl: () => new Promise(() => {})})(URL);
  assert.equal(stalledRequest.status, 'unreachable');
  assert.match(stalledRequest.reason, /süre sınırı/);
  let cancelled = false;
  const stream = new ReadableStream({cancel() {cancelled = true;}});
  const stalledBody = await createChecker({now: STAMP, timeoutMs: 10,
    fetchImpl: async () => new Response(stream, {headers: {'content-type': 'text/html'}})})(URL);
  assert.equal(stalledBody.status, 'unreachable');
  assert.equal(cancelled, true);
});

test('HTTP not-found/server failure do not claim private sharing', async () => {
  for (const status of [404, 410, 503]) {
    const result = await createChecker({now: STAMP, fetchImpl: async () => new Response(null, {status})})(URL);
    assert.equal(result.status, 'unreachable');
    assert.equal(result.httpStatus, status);
  }
});

test('Connection errors never leak the requested resource key or transport message', async () => {
  const result = await createChecker({now: STAMP, fetchImpl: async () => {throw new Error(URL + '?resourcekey=SECRET_KEY');}})(URL + '?resourcekey=SECRET_KEY');
  assert.equal(result.status, 'unreachable');
  assert.equal(JSON.stringify(result).includes('SECRET_KEY'), false);
  assert.equal(JSON.stringify(result).includes(FOLDER_ID), false);
});
