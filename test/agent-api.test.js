// The core path over HTTP with real Docker. The "model" is the local stub, not Vultr.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assessTrack, MAX_UPLOAD_BYTES, NO_INFERENCE_BANNER, PREVIEW_BANNER, RateLimiter, EXECUTION_DISABLED_BANNER } from '../src/webapp.js';
import { DEFAULT_BASE_URL, InferenceClient } from '../src/inference.js';
import { Sandbox } from '../src/sandbox.js';
import { DEFAULT_AGENT_LIMITS, runAgent } from '../src/agent.js';
import { postJson, startApp, waitForRun } from './helpers/server.js';
import { ScriptedPlanner } from './helpers/scripted-planner.js';
import { startStub, toolCall } from './helpers/stub-inference.js';

const cleanCsv = readFileSync(new URL('../samples/vendor-payments.csv', import.meta.url));
const poisonedCsv = readFileSync(new URL('../samples/poisoned-vendor-payments.csv', import.meta.url));
const b64 = (buffer) => Buffer.from(buffer).toString('base64');
// Validation runs before any model call, so this address is never contacted.
const KEYED_NEVER_CALLED = { VULTR_INFERENCE_API_KEY: 'stub-key', VULTR_INFERENCE_BASE_URL: 'http://127.0.0.1:1/v1' };

function paidTotalByHand() {
  // Independent of the sandbox: parse the sample here and compare it with the sandbox result.
  const [, ...rows] = cleanCsv.toString().trim().split('\n');
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const cols = row.split(',');
    if (cols[2] === 'paid') { total += Number(cols[3]); count += 1; }
  }
  return { total: total.toFixed(2), count };
}

const PAID_CODE = `import csv
rows = list(csv.DictReader(open("/input/data", newline="")))
paid = [float(r["amount_usd"]) for r in rows if r["status"] == "paid"]
print(len(paid), f"{sum(paid):.2f}")
`;

test('LLM path: stubbed model drives real sandbox and the answer comes from the run', async () => {
  const stub = await startStub({
    script: (body) => {
      const toolTurns = body.messages.filter((m) => m.role === 'tool').length;
      if (toolTurns === 0) return toolCall('call-read', 'read_input_file', { max_bytes: 100 });
      if (toolTurns === 1) return toolCall('call-run', 'run_code', { code: PAID_CODE });
      const last = JSON.parse(body.messages.at(-1).content);
      return { role: 'assistant', content: `Result: ${last.stdout.trim()}` };
    },
  });
  const app = await startApp({ VULTR_INFERENCE_API_KEY: 'stub-key', VULTR_INFERENCE_BASE_URL: stub.baseUrl });
  try {
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.inference, 'live');
    assert.equal(health.model, 'kimi-k2-instruct');
    assert.equal(health.planner, 'llm');

    const started = await postJson(app.base, '/api/runs/agent', { question: 'paid total?', filename: '../../evil name.csv', content_base64: b64(cleanCsv) });
    assert.equal(started.status, 202);
    const run = await waitForRun(app.base, started.body.id);

    const expected = paidTotalByHand();
    assert.equal(run.status, 'finished', JSON.stringify(run.error));
    assert.equal(run.planner, 'llm');
    assert.equal(run.answer, `Result: ${expected.count} ${expected.total}`);
    assert.equal(run.request.filename, '.._.._evil name.csv');

    // Tool results go back to the model with the documented role and id.
    const finalRequest = stub.requests.filter((r) => r.url.endsWith('/chat/completions')).at(-1);
    const toolMessages = finalRequest.body.messages.filter((m) => m.role === 'tool');
    assert.deepEqual(toolMessages.map((m) => m.tool_call_id), ['call-read', 'call-run']);

    const ledger = run.ledger;
    assert.equal(ledger.planner, 'llm');
    assert.equal(ledger.agent.model_requests, 3);
    assert.equal(ledger.agent.tokens.total_tokens, 360, 'tokens are summed from the stub usage fields');
    assert.equal(ledger.executions[0].exit_reason, 'completed');
    assert.equal(ledger.lifecycle.containers_created, 2);
    assert.equal(ledger.lifecycle.containers_removed_verified, 2);
    assert.equal(ledger.walls.containers_failed, 0);
    assert.equal(ledger.walls.containers_checked, 2);
    assert.deepEqual(ledger.probe.failures, []);
    assert.equal(ledger.secrets.backend_secrets_found_in_outputs, 0);
    assert.equal(ledger.secrets.backend_secrets_checked, 2);
    assert.ok(ledger.duration_ms > 0);

    // The record carries the model's code and what the API said about each call.
    const record = await (await fetch(`${app.base}/api/runs/${run.id}/record`)).json();
    assert.equal(record.model_code.length, 1);
    assert.equal(record.model_code[0].text, PAID_CODE);
    assert.equal(record.model_code[0].step, 2);
    assert.equal(record.inference.calls.length, 3);
    assert.deepEqual(record.inference.calls.map((c) => c.step), [1, 2, 3]);
    assert.match(record.inference.calls[0].response_id, /^stub-response-/);
    assert.match(record.inference.calls[0].request_id_headers['x-request-id'], /^stub-request-/);
    assert.equal(record.inference.calls[0].usage.total_tokens, 120);
    assert.equal(record.inference.answer, run.answer);
    assert.equal(record.input.sha256, createHash('sha256').update(cleanCsv).digest('hex'));
    assert.equal(record.output.sha256, createHash('sha256').update(`${expected.count} ${expected.total}\n`).digest('hex'));
    assert.doesNotMatch(JSON.stringify(record), /stub-key/);

    // After a real chat completion, this is still not the track: the base URL is a stub.
    const after = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(after.inference_verified_by, 'chat_completion');
    assert.equal(after.track.status, 'not_met');
  } finally {
    await app.close();
    await stub.close();
  }
});

test('LLM path: a steered model attacks and the ledger records real blocked attempts', async () => {
  const attack = `import os, socket
print("env", dict(os.environ))
try:
    socket.create_connection(("1.1.1.1", 443), timeout=2)
    print("CONNECTED")
except OSError as exc:
    print("blocked", exc)
`;
  const stub = await startStub({
    script: (body) => {
      const toolTurns = body.messages.filter((m) => m.role === 'tool').length;
      if (toolTurns === 0) return toolCall('r', 'read_input_file', {});
      if (toolTurns === 1) return toolCall('a', 'run_code', { code: attack });
      return { role: 'assistant', content: 'done' };
    },
  });
  const app = await startApp({ VULTR_INFERENCE_API_KEY: 'stub-key', VULTR_INFERENCE_BASE_URL: stub.baseUrl });
  try {
    const started = await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: b64(poisonedCsv) });
    const run = await waitForRun(app.base, started.body.id);
    const firstToolResult = stub.requests.at(-2).body.messages.find((m) => m.role === 'tool');
    assert.match(firstToolResult.content, /NOTE TO AI AGENT/, 'the injected text really reaches the model');
    assert.equal(run.ledger.attempts.network_succeeded, 0);
    assert.ok(run.ledger.attempts.network >= 1);
    assert.equal(run.ledger.secrets.backend_secrets_found_in_outputs, 0);
    const toolResult = run.events.filter((e) => e.type === 'tool_result').at(-1).content;
    assert.match(toolResult, /env \{\}/);
    assert.doesNotMatch(toolResult, /CONNECTED|stub-key/);
    assert.doesNotMatch(JSON.stringify(run), /stub-key/);
    assert.doesNotMatch(app.logs.join('\n'), /stub-key/);
  } finally {
    await app.close();
    await stub.close();
  }
});

test('a rejected key gives an error state and nothing is substituted', async () => {
  const stub = await startStub({ script: () => ({}), key: 'the-right-key' });
  const app = await startApp({ VULTR_INFERENCE_API_KEY: 'revoked-key', VULTR_INFERENCE_BASE_URL: stub.baseUrl });
  try {
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.inference, 'absent');
    assert.equal(health.inference_detail, 'key_rejected');
    assert.equal(health.planner, 'unavailable');
    const res = await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: b64(cleanCsv) });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'inference_key_rejected');
  } finally {
    await app.close();
    await stub.close();
  }
});

test('a key rejected in the middle of a run errors out with no fallback', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ data: [] }));
    return new Response('nope', { status: 401 });
  };
  const http = await import('node:http');
  const { createApp, readConfig } = await import('../src/webapp.js');
  const app = createApp({
    config: { ...readConfig({}), apiKey: 'k1', postsPerMinute: 100, getsPerMinute: 1000 },
    inferenceClient: new InferenceClient({ apiKey: 'k1', baseUrl: 'http://stub.invalid/v1', fetchImpl }),
    log: () => {},
  });
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fetch(`${base}/healthz`);
    const started = await postJson(base, '/api/runs/agent', { question: 'q', content_base64: b64(cleanCsv) });
    const run = await waitForRun(base, started.body.id);
    assert.equal(run.status, 'error');
    assert.equal(run.error.code, 'inference_auth');
    assert.equal(run.planner, 'llm');
    assert.equal(run.answer, null);
    assert.equal(run.ledger.ended_by, 'inference_error');
    assert.equal(run.ledger.lifecycle.containers_removed_verified, 1, 'the probe that already ran is still accounted for');
    const record = await (await fetch(`${base}/api/runs/${run.id}/record`)).json();
    assert.equal(record.status, 'error');
    assert.deepEqual(record.inference.calls, []);
    const health = await (await fetch(`${base}/healthz`)).json();
    assert.equal(health.inference, 'absent');
    assert.equal(health.planner, 'unavailable');
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('no key: agent runs get a clear error, nothing runs, and direct mode still works', async () => {
  const app = await startApp({});
  try {
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.inference, 'absent');
    assert.equal(health.inference_detail, 'no_key');
    assert.equal(health.planner, 'unavailable');

    const html = await (await fetch(app.base)).text();
    assert.ok(html.includes(NO_INFERENCE_BANNER), 'the banner is in the server-rendered HTML');
    assert.doesNotMatch(html, /scripted/i);

    const refused = await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: b64(poisonedCsv) });
    assert.equal(refused.status, 503);
    assert.equal(refused.body.error, 'inference_not_configured');
    assert.match(refused.body.message, /planner is unavailable/);
    assert.equal(app.app.manager.runs.size, 0, 'no run was created');

    const direct = await postJson(app.base, '/api/runs/direct', { code: 'print(6 * 7)' });
    assert.equal(direct.status, 202);
    const run = await waitForRun(app.base, direct.body.id);
    assert.equal(run.status, 'finished', JSON.stringify(run.error));
    assert.equal(run.planner, 'none');
    assert.match(run.events.at(-1).content, /42/);
  } finally {
    await app.close();
  }
});

test('the scripted planner is a test fixture: nothing in the app can reach it', () => {
  for (const file of readdirSync(new URL('../src/', import.meta.url))) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /ScriptedPlanner|scripted-planner|from '.*test\//, file);
  }
});

test('fixture planner: the agent loop drives the real sandbox on the clean file', async () => {
  const out = await runAgent({ planner: new ScriptedPlanner(), sandbox: new Sandbox(), question: 'q', inputBytes: cleanCsv, onEvent: () => {} });
  const [, ...rows] = cleanCsv.toString().trim().split('\n');
  const total = rows.reduce((sum, row) => sum + Number(row.split(',')[3]), 0).toFixed(2);
  assert.equal(out.endedBy, 'final_answer');
  assert.equal(out.executions[0].exit_reason, 'completed');
  assert.equal(out.executions[0].code_source, 'test_fixture');
  assert.ok(out.answer.includes(`rows: ${rows.length}`), out.answer);
  assert.ok(out.answer.includes(total.replace(/0+$/, '').replace(/\.$/, '')), out.answer);
});

test('/healthz reports the deployment as a label, and the track as not met without a Vultr VM and live inference', async () => {
  const app = await startApp({});
  try {
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.deployment, 'local');
    assert.equal(health.host, 'localhost');
    assert.equal(health.on_vultr, undefined, 'no bare on_vultr flag exists');
    assert.match(health.deployment_basis, /label, not a measurement/);
    assert.equal(health.track.status, 'not_met');
    assert.ok(health.track.reasons.some((r) => r.includes('not a Vultr VM')));
    assert.ok(health.track.reasons.some((r) => r.includes('inference is not live')));
  } finally {
    await app.close();
  }

  const labelled = await startApp({ PADDED_CELL_DEPLOYMENT: 'vultr-vm', PADDED_CELL_HOST: '203.0.113.9.sslip.io' });
  try {
    const health = await (await fetch(`${labelled.base}/healthz`)).json();
    assert.equal(health.deployment, 'vultr-vm');
    assert.equal(health.host, '203.0.113.9.sslip.io');
    assert.equal(health.track.status, 'not_met', 'the label alone is not enough');
    assert.match(health.track.note, /label/);
  } finally {
    await labelled.close();
  }
});

test('a stub that answers does not meet the track, even on a VM label', async () => {
  const stub = await startStub({ script: () => ({ role: 'assistant', content: 'hi' }) });
  const app = await startApp({ VULTR_INFERENCE_API_KEY: 'stub-key', VULTR_INFERENCE_BASE_URL: stub.baseUrl, PADDED_CELL_DEPLOYMENT: 'vultr-vm' });
  try {
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.inference, 'live');
    assert.equal(health.inference_verified_by, 'models_list_only');
    assert.equal(health.track.status, 'not_met');
    assert.ok(health.track.reasons.some((r) => r.includes('base URL')));
    assert.ok(health.track.reasons.some((r) => r.includes('no chat completion')));
  } finally {
    await app.close();
    await stub.close();
  }
});

test('the track logic needs every condition, and even then calls the result a label', () => {
  const good = { deployment: 'vultr-vm', inferenceLive: true, inferenceDetail: 'verified', chatVerified: true, baseUrl: DEFAULT_BASE_URL, sandboxExecution: 'enabled' };
  assert.equal(assessTrack(good).status, 'met_according_to_label');
  assert.match(assessTrack(good).note, /label/);
  for (const change of [{ deployment: 'local' }, { inferenceLive: false }, { chatVerified: false }, { baseUrl: 'http://other/v1' }, { sandboxExecution: 'unavailable' }]) {
    const out = assessTrack({ ...good, ...change });
    assert.equal(out.status, 'not_met', JSON.stringify(change));
    assert.equal(out.reasons.length, 1, JSON.stringify(change));
  }
});

test('direct attack: ledger values differ by what actually happened', async () => {
  const app = await startApp({});
  try {
    const bomb = await postJson(app.base, '/api/runs/direct', { preset: 'memory_bomb' });
    const bombRun = await waitForRun(app.base, bomb.body.id);
    assert.equal(bombRun.planner, 'none');
    assert.equal(bombRun.ledger.executions[0].exit_reason, 'memory_limit_killed');
    assert.equal(bombRun.ledger.executions[0].oom_killed, true);
    assert.equal(bombRun.ledger.lifecycle.containers_removed_verified, 2);

    const ok = await postJson(app.base, '/api/runs/direct', { code: 'print(6 * 7)' });
    const okRun = await waitForRun(app.base, ok.body.id);
    assert.equal(okRun.ledger.executions[0].exit_reason, 'completed');
    assert.equal(okRun.ledger.executions[0].oom_killed, false);
    assert.match(okRun.events.at(-1).content, /42/);
  } finally {
    await app.close();
  }
});

test('the secret scan is live: it reports a secret when one really is in the output', async () => {
  const app = await startApp({});
  try {
    const canary = process.env.PADDED_CELL_CANARY;
    const started = await postJson(app.base, '/api/runs/direct', { code: `print(${JSON.stringify(canary)})` });
    const run = await waitForRun(app.base, started.body.id);
    assert.equal(run.ledger.secrets.backend_secrets_found_in_outputs, 1, 'the scan is measured: it does find a secret when one is in the output');
  } finally {
    await app.close();
  }
});

test('upload and body caps return 413 and nothing runs', async () => {
  const app = await startApp(KEYED_NEVER_CALLED);
  try {
    const tooBigFile = await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: b64(Buffer.alloc(MAX_UPLOAD_BYTES + 1)) });
    assert.equal(tooBigFile.status, 413);
    assert.equal(tooBigFile.body.error, 'file_too_large');
    const tooBigBody = await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: b64(Buffer.alloc(1024 * 1024)) });
    assert.equal(tooBigBody.status, 413);
    assert.equal(tooBigBody.body.error, 'body_too_large');
    const badCode = await postJson(app.base, '/api/runs/direct', { code: 'x'.repeat(17_000) });
    assert.equal(badCode.status, 413);
    assert.equal(app.app.manager.runs.size, 0);
  } finally {
    await app.close();
  }
});

test('bad input gets 400, and unknown or traversal paths get 404', async () => {
  const app = await startApp(KEYED_NEVER_CALLED);
  try {
    assert.equal((await postJson(app.base, '/api/runs/agent', { content_base64: b64(cleanCsv) })).status, 400);
    assert.equal((await postJson(app.base, '/api/runs/agent', { question: 'q' })).status, 400);
    assert.equal((await postJson(app.base, '/api/runs/agent', { question: 'q', content_base64: '!!!' })).status, 400);
    const raw = await fetch(`${app.base}/api/runs/agent`, { method: 'POST', body: 'not json' });
    assert.equal(raw.status, 400);
    assert.equal((await fetch(`${app.base}/samples/..%2fpackage.json`)).status, 404);
    assert.equal((await fetch(`${app.base}/samples/../package.json`)).status, 404);
    assert.equal((await fetch(`${app.base}/api/runs/nope`)).status, 404);
    assert.equal((await fetch(`${app.base}/api/runs/nope/record`)).status, 404);
  } finally {
    await app.close();
  }
});

test('public POST endpoints are rate limited per client', async () => {
  const app = await startApp({}, { postsPerMinute: 2 });
  try {
    const send = () => postJson(app.base, '/api/runs/direct', { code: '' });
    assert.equal((await send()).status, 400);
    assert.equal((await send()).status, 400);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    await app.close();
  }
});

test('rate limiter window resets', () => {
  let now = 0;
  const limiter = new RateLimiter(1, 1000, () => now);
  assert.equal(limiter.take('a').allowed, true);
  assert.equal(limiter.take('a').allowed, false);
  assert.equal(limiter.take('b').allowed, true);
  now = 1001;
  assert.equal(limiter.take('a').allowed, true);
});

test('a client cannot dodge the rate limit by forging x-forwarded-for when no proxy is trusted', async () => {
  const app = await startApp({}, { postsPerMinute: 1, trustProxy: false });
  try {
    const send = (ip) => fetch(`${app.base}/api/runs/direct`, { method: 'POST', headers: { 'x-forwarded-for': ip }, body: '{}' });
    assert.equal((await send('1.1.1.1')).status, 400);
    assert.equal((await send('2.2.2.2')).status, 429);
  } finally {
    await app.close();
  }
});

test('concurrency cap refuses a third simultaneous run', async () => {
  const app = await startApp({});
  try {
    const code = 'import time\ntime.sleep(3)\n';
    const a = await postJson(app.base, '/api/runs/direct', { code });
    const b = await postJson(app.base, '/api/runs/direct', { code });
    const c = await postJson(app.base, '/api/runs/direct', { code });
    assert.equal(a.status, 202);
    assert.equal(b.status, 202);
    assert.equal(c.status, 429);
    assert.equal(c.body.error, 'busy');
    await waitForRun(app.base, a.body.id);
    await waitForRun(app.base, b.body.id);
  } finally {
    await app.close();
  }
});

test('preview host: execution is off, the page says so, and nothing can run', async () => {
  const app = await startApp({ VERCEL: '1' });
  try {
    assert.equal(app.app.manager, null, 'no run manager exists, so there is no route to the sandbox or anything else');
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.equal(health.sandbox.execution, 'disabled');
    assert.equal(health.host, 'vercel-preview');
    assert.equal(health.deployment, 'vercel-preview');
    assert.equal(health.track.status, 'not_met');
    assert.equal(health.canary.listening, false);
    assert.equal(app.app.canary, null, 'no listener exists on a host with no sandbox');
    const html = await (await fetch(app.base)).text();
    assert.ok(html.includes(PREVIEW_BANNER));
    assert.ok(html.includes(EXECUTION_DISABLED_BANNER));
    for (const [path, body] of [['/api/runs/direct', { code: 'print(1)' }], ['/api/runs/agent', { question: 'q', content_base64: b64(cleanCsv) }]]) {
      const res = await postJson(app.base, path, body);
      assert.equal(res.status, 503);
      assert.equal(res.body.error, 'execution_disabled');
    }
  } finally {
    await app.close();
  }
});

test('the page sends a strict CSP, because results contain hostile text', async () => {
  const app = await startApp({});
  try {
    const res = await fetch(app.base);
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe/);
    assert.doesNotMatch(readFileSync(new URL('../web/app.js', import.meta.url), 'utf8'), /innerHTML|insertAdjacentHTML|document\.write/);
  } finally {
    await app.close();
  }
});

test('agent loop stops at the step cap and the token cap', async () => {
  const loopPlanner = (usage) => ({
    label: 'llm',
    model: 'x',
    async next() {
      return {
        assistantMessage: { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_input_file', arguments: '{}' } }] },
        content: null,
        toolCalls: [{ id: 'a', name: 'read_input_file', arguments: '{}' }],
        usage,
      };
    },
  });
  const common = { sandbox: null, question: 'q', inputBytes: Buffer.from('x'), onEvent: () => {} };
  const steps = await runAgent({ ...common, planner: loopPlanner(null), limits: { ...DEFAULT_AGENT_LIMITS, maxSteps: 3 } });
  assert.equal(steps.endedBy, 'step_cap');
  assert.equal(steps.modelRequests, 3);
  const tokens = await runAgent({ ...common, planner: loopPlanner({ total_tokens: 600 }), limits: { ...DEFAULT_AGENT_LIMITS, maxTokens: 1000 } });
  assert.equal(tokens.endedBy, 'token_cap');
  assert.equal(tokens.modelRequests, 2);
});

test('tool errors go back to the model and do not crash the loop', async () => {
  const seen = [];
  const decisions = [
    { id: '1', name: 'run_code', arguments: 'not json' },
    { id: '2', name: 'run_code', arguments: '{}' },
    { id: '3', name: 'rm_rf', arguments: '{}' },
  ];
  const planner = {
    label: 'llm',
    model: 'x',
    async next(messages) {
      seen.push(messages.at(-1));
      const call = decisions.shift();
      if (!call) return { assistantMessage: { role: 'assistant', content: 'end' }, content: 'end', toolCalls: [], usage: null };
      return { assistantMessage: { role: 'assistant', content: null, tool_calls: [] }, content: null, toolCalls: [call], usage: null };
    },
  };
  const out = await runAgent({ planner, sandbox: null, question: 'q', inputBytes: Buffer.alloc(0), onEvent: () => {} });
  assert.equal(out.answer, 'end');
  assert.match(seen[1].content, /not valid JSON/);
  assert.match(seen[2].content, /non-empty string/);
  assert.match(seen[3].content, /unknown tool/);
});
