import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, InferenceClient, redact } from './inference.js';
import { LlmPlanner, ScriptedPlanner } from './planners.js';
import { PRESETS } from './presets.js';
import { BudgetError, BusyError, RunManager, publicRun } from './runs.js';
import { Sandbox, reapScratch, reapStale } from './sandbox.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_UPLOAD_BYTES = 200 * 1024;
export const MAX_BODY_BYTES = 300 * 1024;
const MAX_QUESTION_CHARS = 1_000;
const MAX_CODE_CHARS = 16_000;
const SAMPLES = new Set(['vendor-payments.csv', 'poisoned-vendor-payments.csv']);
const STATIC = {
  '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['web/style.css', 'text/css; charset=utf-8'],
};
export const SCRIPTED_BANNER = 'SCRIPTED PLANNER: no LLM in use. Not the Vultr inference product.';
export const PREVIEW_BANNER = 'PREVIEW, NOT ON VULTR: this host does not satisfy the Challenge 1 rule, which requires a Vultr VM and Vultr Serverless Inference.';
export const EXECUTION_DISABLED_BANNER = 'CODE EXECUTION IS DISABLED ON THIS HOST: it cannot run the hardened Docker sandbox, so nothing uploaded or generated will run here.';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export function readConfig(env = process.env) {
  const onVercel = Boolean(env.VERCEL);
  const execution = onVercel || env.PADDED_CELL_EXECUTION === 'disabled' ? 'disabled' : 'docker';
  return {
    apiKey: env.VULTR_INFERENCE_API_KEY || null,
    baseUrl: env.VULTR_INFERENCE_BASE_URL || DEFAULT_BASE_URL,
    model: env.VULTR_INFERENCE_MODEL || DEFAULT_MODEL,
    execution,
    executionDisabledReason: onVercel ? 'This serverless host cannot run the hardened Docker sandbox.' : 'Disabled by PADDED_CELL_EXECUTION.',
    hostLabel: onVercel ? 'vercel-preview' : env.PADDED_CELL_HOST_LABEL || 'local',
    trustProxy: onVercel || env.PADDED_CELL_TRUST_PROXY === '1',
    image: env.PADDED_CELL_IMAGE || 'padded-cell-sandbox:latest',
    postsPerMinute: Number(env.PADDED_CELL_POSTS_PER_MINUTE || 6),
    getsPerMinute: Number(env.PADDED_CELL_GETS_PER_MINUTE || 240),
  };
}

export class RateLimiter {
  constructor(limit, windowMs = 60_000, now = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.buckets = new Map();
  }

  take(key) {
    const now = this.now();
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
      // If the map is still huge, drop everything. That is more lenient, but it cannot exhaust memory.
      if (this.buckets.size > 10_000) this.buckets.clear();
    }
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return { allowed: bucket.count <= this.limit, retryAfterS: Math.ceil((bucket.resetAt - now) / 1000) };
  }
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) {
      req.resume();
      reject(new HttpError(413, 'body_too_large', `Request body limit is ${MAX_BODY_BYTES} bytes.`));
      return;
    }
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        reject(new HttpError(413, 'body_too_large', `Request body limit is ${MAX_BODY_BYTES} bytes.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function parseJson(buffer) {
  try {
    const value = JSON.parse(buffer.toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* handled below */ }
  throw new HttpError(400, 'bad_json', 'Body must be a JSON object.');
}

function decodeUpload(body, { required }) {
  if (body.content_base64 === undefined || body.content_base64 === null) {
    if (required) throw new HttpError(400, 'file_required', 'Upload a file first.');
    return Buffer.alloc(0);
  }
  if (typeof body.content_base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.content_base64)) {
    throw new HttpError(400, 'bad_file', 'content_base64 must be base64.');
  }
  const bytes = Buffer.from(body.content_base64, 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, 'file_too_large', `File limit is ${MAX_UPLOAD_BYTES} bytes.`);
  }
  if (required && bytes.length === 0) throw new HttpError(400, 'file_required', 'The uploaded file is empty.');
  return bytes;
}

/** Only for display. The name never reaches the filesystem: the file is always /input/data. */
function displayName(value) {
  return typeof value === 'string' ? value.replace(/[^\w.\- ]/g, '_').slice(0, 80) : null;
}

export function createApp({ config = readConfig(), sandbox, inferenceClient, fetchImpl, log = defaultLog } = {}) {
  const canary = `pc-canary-${randomBytes(16).toString('hex')}`;
  // A canary in the backend's own environment. The ledger checks it never turns up in sandbox output.
  process.env.PADDED_CELL_CANARY = canary;
  const secrets = [config.apiKey, canary];
  const safeLog = (event, data = {}) => log(redact(JSON.stringify({ at: new Date().toISOString(), event, ...data }), secrets));

  const client = inferenceClient ?? (config.apiKey
    ? new InferenceClient({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model, fetchImpl })
    : null);
  const activeSandbox = config.execution === 'docker'
    ? sandbox ?? new Sandbox({ image: config.image })
    : null;

  // /healthz says "live" only after the API has actually answered this process.
  const inferenceState = { verifiedAt: 0, detail: client ? 'key_configured_unverified' : 'no_key', live: false };
  const noteInference = (err) => {
    if (!err) {
      inferenceState.live = true;
      inferenceState.detail = 'verified';
      inferenceState.verifiedAt = Date.now();
    } else if (err.kind === 'auth') {
      inferenceState.live = false;
      inferenceState.detail = 'key_rejected';
    } else {
      inferenceState.live = false;
      inferenceState.detail = `error_${err.kind}`;
    }
  };

  const manager = activeSandbox ? new RunManager({
    sandbox: activeSandbox,
    createPlanner: () => (client ? new LlmPlanner(client) : new ScriptedPlanner()),
    secrets,
    hostLabel: config.hostLabel,
    onInference: noteInference,
    log: safeLog,
  }) : null;

  const postLimit = new RateLimiter(config.postsPerMinute);
  const getLimit = new RateLimiter(config.getsPerMinute);
  let sandboxCache = { at: 0, value: null };

  async function sandboxStatus() {
    if (!activeSandbox) return { runtime: 'none', execution: 'disabled', reason: config.executionDisabledReason };
    if (Date.now() - sandboxCache.at < 15_000 && sandboxCache.value) return sandboxCache.value;
    const available = await activeSandbox.available();
    const value = available.ok
      ? { runtime: 'docker', execution: 'enabled', image: activeSandbox.image, image_id: available.imageId }
      : { runtime: 'docker', execution: 'unavailable', image: activeSandbox.image, reason: 'Sandbox image or Docker daemon not available.' };
    sandboxCache = { at: Date.now(), value };
    return value;
  }

  async function refreshInference() {
    if (!client || Date.now() - inferenceState.verifiedAt < 60_000) return;
    if (inferenceState.detail === 'key_rejected') return;
    try {
      await client.listModels();
      noteInference(null);
    } catch (err) {
      noteInference(err);
      inferenceState.verifiedAt = Date.now();
    }
  }

  async function health() {
    await refreshInference();
    const sandboxInfo = await sandboxStatus();
    let planner = 'scripted';
    if (client) planner = inferenceState.detail === 'key_rejected' ? 'unavailable' : 'llm';
    return {
      status: 'ok',
      inference: inferenceState.live ? 'live' : 'absent',
      inference_detail: inferenceState.detail,
      inference_base_url: client ? config.baseUrl : null,
      model: client ? client.model : null,
      planner,
      sandbox: sandboxInfo,
      host: config.hostLabel,
      on_vultr: config.hostLabel === 'vultr-vm',
    };
  }

  function bannerHtml() {
    const banners = [];
    if (!client) banners.push(['scripted', SCRIPTED_BANNER]);
    if (config.hostLabel === 'vercel-preview') banners.push(['preview', PREVIEW_BANNER]);
    else if (config.hostLabel !== 'vultr-vm') banners.push(['preview', `NOT A VULTR DEPLOYMENT: running on host "${escapeHtml(config.hostLabel)}".`]);
    if (!activeSandbox) banners.push(['disabled', EXECUTION_DISABLED_BANNER]);
    return banners.map(([kind, text]) => `<div class="banner banner-${kind}" role="alert" data-testid="banner-${kind}">${text}</div>`).join('');
  }

  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };

  function clientIp(req) {
    if (config.trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      // The closest proxy appends the address it saw, and that is the only entry a client cannot forge.
      if (forwarded.length) return forwarded.at(-1);
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }

  async function postRun(req, res, kind) {
    if (!manager) throw new HttpError(503, 'execution_disabled', EXECUTION_DISABLED_BANNER);
    const status = await sandboxStatus();
    if (status.execution !== 'enabled') throw new HttpError(503, 'sandbox_unavailable', status.reason);
    if (client && inferenceState.detail === 'key_rejected' && kind === 'agent') {
      throw new HttpError(503, 'inference_key_rejected', 'The inference key was rejected. The planner is unavailable, and there is no fallback.');
    }
    const body = parseJson(await readBody(req));
    let run;
    if (kind === 'agent') {
      const question = typeof body.question === 'string' ? body.question.trim() : '';
      if (!question) throw new HttpError(400, 'question_required', 'Ask a question.');
      if (question.length > MAX_QUESTION_CHARS) throw new HttpError(400, 'question_too_long', `Question limit is ${MAX_QUESTION_CHARS} characters.`);
      run = manager.startAgent({ question, inputBytes: decodeUpload(body, { required: true }), filename: displayName(body.filename) });
    } else {
      const preset = PRESETS.find((p) => p.id === body.preset);
      const code = preset ? preset.code : body.code;
      if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'code_required', 'Choose a preset or provide code.');
      if (code.length > MAX_CODE_CHARS) throw new HttpError(413, 'code_too_large', `Code limit is ${MAX_CODE_CHARS} characters.`);
      run = manager.startDirect({ code, inputBytes: decodeUpload(body, { required: false }), presetId: preset?.id ?? null });
    }
    json(res, 202, { id: run.id });
  }

  async function serveFile(res, relative, type) {
    const data = await readFile(path.join(ROOT, relative));
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://local');
    const method = req.method;
    const pathname = url.pathname;
    const limiter = method === 'POST' ? postLimit : getLimit;
    const verdict = limiter.take(clientIp(req));
    if (!verdict.allowed) {
      json(res, 429, { error: 'rate_limited', message: 'Too many requests.' }, { 'Retry-After': String(verdict.retryAfterS) });
      return;
    }
    if (method === 'POST' && pathname === '/api/runs/agent') return postRun(req, res, 'agent');
    if (method === 'POST' && pathname === '/api/runs/direct') return postRun(req, res, 'direct');
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');

    if (pathname === '/healthz') return json(res, 200, await health());
    if (pathname === '/api/presets') return json(res, 200, { presets: PRESETS });
    if (pathname.startsWith('/api/runs/')) {
      const run = manager?.get(pathname.slice('/api/runs/'.length));
      if (!run) throw new HttpError(404, 'run_not_found', 'No such run, or it has expired.');
      return json(res, 200, publicRun(run));
    }
    if (pathname === '/') {
      const html = await readFile(path.join(ROOT, 'web/index.html'), 'utf8');
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html.replace('<!--BANNERS-->', bannerHtml()));
      return undefined;
    }
    if (STATIC[pathname]) return serveFile(res, ...STATIC[pathname]);
    if (pathname.startsWith('/samples/')) {
      const name = pathname.slice('/samples/'.length);
      if (SAMPLES.has(name)) return serveFile(res, `samples/${name}`, 'text/plain; charset=utf-8');
    }
    throw new HttpError(404, 'not_found', 'Not found.');
  }

  const handle = (req, res) => route(req, res).catch((err) => {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.code, message: err.message }, err.status === 413 ? { Connection: 'close' } : {});
    } else if (err instanceof BusyError) {
      json(res, 429, { error: 'busy', message: err.message }, { 'Retry-After': '10' });
    } else if (err instanceof BudgetError) {
      json(res, 429, { error: 'budget', message: err.message }, { 'Retry-After': '600' });
    } else {
      safeLog('request_failed', { path: req.url?.slice(0, 200), error: err.message });
      if (!res.headersSent) json(res, 500, { error: 'internal', message: 'Internal error.' });
      else res.end();
    }
  });

  let reaper = null;
  return {
    handle,
    manager,
    health,
    startBackground() {
      if (!activeSandbox || reaper) return;
      const reap = () => Promise.all([reapStale(5 * 60_000), reapScratch(activeSandbox.workDir, 5 * 60_000)]).then(([containers, dirs]) => {
        if (containers.length || dirs.length) safeLog('reaped_stale', { containers: containers.length, scratch_dirs: dirs.length });
      }).catch(() => {});
      reap();
      reaper = setInterval(reap, 60_000);
      reaper.unref();
    },
    stopBackground() {
      if (reaper) clearInterval(reaper);
      reaper = null;
    },
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function defaultLog(line) {
  console.log(line);
}
