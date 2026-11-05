import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

function request(path, method = 'GET', body, headers = {}) {
  const req = Readable.from([]);
  req.url = path; req.method = method;
  req.headers = { host: 'example.vercel.app', ...headers };
  if (body !== undefined) req.body = body;
  return req;
}
async function invoke(handler, req) {
  let status, data, headers;
  await handler(req, { writeHead(code, values) { status = code; headers = values; }, end(text) { data = JSON.parse(text); } });
  return { status, data, headers };
}
const input = { company: 'Amazon', position: 'Backend Engineer', msgType: 'recruiter', channel: 'message', resumeText: 'Atharva, backend engineer with Go experience.', resumeUrl: 'https://example.com/resume' };

test('production status and generation entrypoints exist without the Vite server', async () => {
  const status = (await import('../api/groq/status.js')).default;
  const generate = (await import('../api/groq/generate.js')).default;
  assert.equal(typeof status, 'function');
  assert.equal(typeof generate, 'function');
  const result = await invoke(status, request('/api/groq/status'));
  assert.equal(result.status, 200);
  assert.equal(typeof result.data.configured, 'boolean');
  assert.ok(!JSON.stringify(result.data).includes('apiKey'));
});

test('production generation accepts Vercel-parsed JSON and preserves validation', async () => {
  const { createVercelHandler } = await import('../server/vercel.js');
  let calls = 0;
  const handler = createVercelHandler('/api/groq/generate', { apiKey: 'test-key' }, async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: '{"subject":"","message":"Hi, I work with Go."}' } }] });
  });
  const headers = { 'content-type': 'application/json', origin: 'https://example.vercel.app' };
  const result = await invoke(handler, request('/api/groq/generate', 'POST', input, headers));
  assert.equal(result.status, 200);
  assert.match(result.data.message, /Hi, I work with Go/);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(calls, 1);
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', {...input, company: ''}, headers))).status, 400);
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', input, {...headers,origin:'https://foreign.example'}))).status, 403);
  assert.equal(calls, 1);
});

test('production body limits and missing credentials return JSON errors', async () => {
  const { createVercelHandler } = await import('../server/vercel.js');
  const handler = createVercelHandler('/api/groq/generate', {});
  const headers = { 'content-type': 'application/json' };
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', input, headers))).status, 503);
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', {...input,resumeText:'x'.repeat(128001)}, headers))).status, 413);
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', '{broken', headers))).status, 400);
  assert.equal((await invoke(handler, request('/api/groq/generate', 'POST', JSON.stringify(input), headers))).status, 503);
});
