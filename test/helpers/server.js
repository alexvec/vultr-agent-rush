import http from 'node:http';
import { createApp, readConfig } from '../../src/app.js';

export async function startApp(env = {}, overrides = {}) {
  const config = { ...readConfig({ ...env }), postsPerMinute: 1000, getsPerMinute: 10000, ...overrides };
  const logs = [];
  const app = createApp({ config, log: (line) => logs.push(line) });
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    app,
    base,
    logs,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }),
  };
}

export async function postJson(base, path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

export async function waitForRun(base, id, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const run = await (await fetch(`${base}/api/runs/${id}`)).json();
    if (run.status !== 'running') return run;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`run ${id} did not finish in time`);
}
