// LOCAL STUB ONLY. None of this has talked to Vultr.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, InferenceClient, InferenceError, NOT_RETURNED, redact } from '../src/inference.js';
import { LlmPlanner, TOOLS } from '../src/planners.js';
import { startStub, toolCall } from './helpers/stub-inference.js';

test('defaults match docs/competition.md section 12', () => {
  assert.equal(DEFAULT_BASE_URL, 'https://api.vultrinference.com/v1');
  assert.equal(DEFAULT_MODEL, 'kimi-k2-instruct');
});

test('chat sends the documented path, headers and body', async () => {
  const stub = await startStub({ script: () => ({ role: 'assistant', content: 'hello' }) });
  try {
    const client = new InferenceClient({ apiKey: 'stub-key', baseUrl: stub.baseUrl });
    const out = await client.chat({ messages: [{ role: 'user', content: 'hi' }], tools: TOOLS, maxTokens: 64 });
    assert.equal(out.message.content, 'hello');
    const req = stub.requests[0];
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.auth, 'Bearer stub-key');
    assert.equal(req.contentType, 'application/json');
    assert.equal(req.body.model, 'kimi-k2-instruct');
    assert.equal(req.body.max_tokens, 64);
    assert.equal(req.body.tool_choice, 'auto');
    assert.deepEqual(req.body.tools.map((t) => t.function.name), ['read_input_file', 'run_code']);
  } finally {
    await stub.close();
  }
});

test('planner turns tool_calls into tool decisions', async () => {
  const stub = await startStub({ script: () => toolCall('c1', 'run_code', { code: 'print(1)' }) });
  try {
    const planner = new LlmPlanner(new InferenceClient({ apiKey: 'stub-key', baseUrl: stub.baseUrl }));
    const decision = await planner.next([{ role: 'user', content: 'x' }]);
    assert.equal(decision.toolCalls[0].name, 'run_code');
    assert.equal(decision.toolCalls[0].id, 'c1');
    assert.equal(decision.usage.total_tokens, 120);
  } finally {
    await stub.close();
  }
});

test('the client reports the response id, model, usage and request id the API returned', async () => {
  const stub = await startStub({ script: () => ({ role: 'assistant', content: 'hello' }) });
  try {
    const client = new InferenceClient({ apiKey: 'stub-key', baseUrl: stub.baseUrl });
    const { inference } = await client.chat({ messages: [] });
    assert.deepEqual(inference, {
      requested_model: 'kimi-k2-instruct',
      response_id: 'stub-response-1',
      model: 'kimi-k2-instruct',
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      request_id_headers: { 'x-request-id': 'stub-request-1' },
    });
  } finally {
    await stub.close();
  }
});

test('fields the API leaves out are recorded as not returned and never invented', async () => {
  const stub = await startStub({ script: () => ({ role: 'assistant', content: 'hello' }), bareResponses: true });
  try {
    const planner = new LlmPlanner(new InferenceClient({ apiKey: 'stub-key', baseUrl: stub.baseUrl }));
    const { inference } = await planner.next([]);
    assert.deepEqual(inference, {
      requested_model: 'kimi-k2-instruct',
      response_id: NOT_RETURNED,
      model: NOT_RETURNED,
      usage: NOT_RETURNED,
      request_id_headers: NOT_RETURNED,
    });
    assert.equal(NOT_RETURNED, 'not returned');
  } finally {
    await stub.close();
  }
});

test('a rejected key becomes an auth error and the key does not appear in it', async () => {
  const stub = await startStub({ script: () => ({}), key: 'the-right-key' });
  try {
    const client = new InferenceClient({ apiKey: 'wrong-key-value', baseUrl: stub.baseUrl });
    await assert.rejects(client.chat({ messages: [] }), (err) => {
      assert.ok(err instanceof InferenceError);
      assert.equal(err.kind, 'auth');
      assert.equal(err.status, 401);
      assert.doesNotMatch(err.message, /wrong-key-value/);
      return true;
    });
  } finally {
    await stub.close();
  }
});

test('an upstream error echoing the key is redacted', async () => {
  const fetchImpl = async () => new Response('bad key: secret-abc', { status: 500 });
  const client = new InferenceClient({ apiKey: 'secret-abc', baseUrl: 'http://stub.invalid/v1', fetchImpl });
  await assert.rejects(client.chat({ messages: [] }), (err) => {
    assert.equal(err.kind, 'upstream');
    assert.doesNotMatch(err.message, /secret-abc/);
    return true;
  });
  assert.equal(redact('a secret-abc b', ['secret-abc', null]), 'a [REDACTED] b');
});

test('an unreachable host and a non-JSON body give typed errors', async () => {
  const down = new InferenceClient({ apiKey: 'k', baseUrl: 'http://127.0.0.1:1/v1', timeoutMs: 1000 });
  await assert.rejects(down.chat({ messages: [] }), (err) => err.kind === 'network');
  const html = new InferenceClient({ apiKey: 'k', baseUrl: 'http://x.invalid/v1', fetchImpl: async () => new Response('<html>') });
  await assert.rejects(html.chat({ messages: [] }), (err) => err.kind === 'bad_response');
});
