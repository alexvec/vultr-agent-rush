// Client for Vultr Serverless Inference (docs/competition.md section 12).
// So far it has only been exercised against the local stub in test/helpers/stub-inference.js.
export const DEFAULT_BASE_URL = 'https://api.vultrinference.com/v1';
export const DEFAULT_MODEL = 'kimi-k2-instruct';

export class InferenceError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'InferenceError';
    this.kind = kind; // auth | rate_limit | upstream | network | bad_response
    this.status = status;
  }
}

export function redact(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

export class InferenceClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, timeoutMs = 60_000, fetchImpl = globalThis.fetch }) {
    if (!apiKey) throw new Error('InferenceClient needs an API key');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async #request(path, init = {}) {
    let res;
    try {
      res = await this.fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new InferenceError('network', redact(`Inference request failed: ${err.message}`, [this.apiKey]));
    }
    const text = await res.text();
    if (!res.ok) {
      const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limit' : 'upstream';
      throw new InferenceError(kind, redact(`Inference API returned ${res.status}: ${text.slice(0, 300)}`, [this.apiKey]), res.status);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new InferenceError('bad_response', 'Inference API returned a body that is not JSON', res.status);
    }
  }

  listModels() {
    return this.#request('/models', { method: 'GET' });
  }

  /** One non-streaming chat completion. No retries, so a failure is visible and spend stays bounded. */
  async chat({ messages, tools, toolChoice = 'auto', maxTokens = 1024 }) {
    const body = { model: this.model, messages, max_tokens: maxTokens };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = toolChoice;
    }
    const json = await this.#request('/chat/completions', { method: 'POST', body: JSON.stringify(body) });
    const message = json?.choices?.[0]?.message;
    if (!message) throw new InferenceError('bad_response', 'Inference response had no choices[0].message');
    return { message, usage: json.usage ?? null, model: json.model ?? this.model };
  }
}
