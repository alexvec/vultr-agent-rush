import { randomBytes } from 'node:crypto';
import { DEFAULT_AGENT_LIMITS, runAgent } from './agent.js';
import { InferenceError, redact } from './inference.js';
import { buildLedger } from './ledger.js';
import { assessProbe } from './sandbox.js';

const RUN_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_RUNS = 100;

export class BusyError extends Error {}
export class BudgetError extends Error {}

/** Holds in-memory runs, with a TTL, a concurrency cap and an hourly budget on model-driven runs. */
export class RunManager {
  constructor({ sandbox, createPlanner, secrets, hostLabel, onInference, maxConcurrent = 2, llmRunsPerHour = 30, agentLimits = DEFAULT_AGENT_LIMITS, log = () => {} }) {
    this.sandbox = sandbox;
    this.createPlanner = createPlanner;
    this.secrets = secrets;
    this.hostLabel = hostLabel;
    this.onInference = onInference ?? (() => {});
    this.maxConcurrent = maxConcurrent;
    this.llmRunsPerHour = llmRunsPerHour;
    this.agentLimits = agentLimits;
    this.log = log;
    this.runs = new Map();
    this.active = 0;
    this.llmStarts = [];
  }

  get(id) {
    this.#purge();
    return this.runs.get(id) ?? null;
  }

  startAgent({ question, inputBytes, filename }) {
    const planner = this.createPlanner();
    if (planner.label === 'llm') {
      const cutoff = Date.now() - 3_600_000;
      this.llmStarts = this.llmStarts.filter((t) => t > cutoff);
      if (this.llmStarts.length >= this.llmRunsPerHour) {
        throw new BudgetError('The hourly cap on model-driven runs has been reached.');
      }
    }
    const run = this.#begin('agent', planner.label, planner.model, { question, filename });
    if (planner.label === 'llm') this.llmStarts.push(Date.now());
    this.#finish(run, this.#agentBody(run, planner, question, inputBytes));
    return run;
  }

  startDirect({ code, inputBytes, presetId }) {
    const run = this.#begin('direct', 'none', null, { preset: presetId ?? null });
    this.#finish(run, this.#directBody(run, code, inputBytes));
    return run;
  }

  #begin(kind, planner, model, request) {
    this.#purge();
    if (this.active >= this.maxConcurrent) throw new BusyError('All sandbox slots are in use.');
    this.active += 1;
    const run = {
      id: randomBytes(9).toString('hex'),
      kind,
      planner,
      model,
      request,
      status: 'running',
      startedAt: Date.now(),
      events: [],
      answer: null,
      error: null,
      ledger: null,
    };
    this.runs.set(run.id, run);
    return run;
  }

  #emit(run, event) {
    run.events.push({ at: new Date().toISOString(), planner: run.planner, ...event });
  }

  #finish(run, body) {
    body.catch((err) => {
      run.status = 'error';
      if (err instanceof InferenceError) {
        this.onInference(err);
        // No fallback to the scripted planner. The run fails and says why.
        run.error = {
          code: `inference_${err.kind}`,
          message: redact(err.message, this.secrets),
          fallback: 'none: the scripted planner is never substituted for a failed model',
        };
      } else {
        this.log('run_failed', { id: run.id, error: redact(err.message, this.secrets) });
        run.error = { code: 'internal', message: 'The run failed inside the backend.' };
      }
      this.#emit(run, { type: 'error', code: run.error.code, message: run.error.message });
    }).finally(() => {
      this.active -= 1;
      if (run.status === 'running') run.status = 'finished';
      this.log('run_finished', { id: run.id, kind: run.kind, planner: run.planner, status: run.status });
    });
  }

  async #probe(run, inputBytes) {
    this.#emit(run, { type: 'probe_start' });
    const probe = await this.sandbox.probe({ inputBytes });
    const failures = probe.started ? assessProbe(probe.observed) : [probe.error ?? probe.exit_reason];
    this.#emit(run, { type: 'probe_result', failures, container: probe.container, removed_verified: probe.removed_verified });
    return { probe, failures };
  }

  #seal(run, { probe, executions = [], usage = null, modelRequests = 0, endedBy, extraTexts = [] }) {
    const scanTexts = [...extraTexts];
    for (const c of [probe, ...executions]) {
      if (c) scanTexts.push(c.stdout, c.stderr);
    }
    run.ledger = buildLedger({
      runId: run.id,
      kind: run.kind,
      planner: run.planner,
      model: run.model,
      startedAt: run.startedAt,
      finishedAt: Date.now(),
      probe,
      executions,
      usage,
      modelRequests,
      endedBy,
      scanTexts,
      secrets: this.secrets,
      hostLabel: this.hostLabel,
    });
  }

  async #agentBody(run, planner, question, inputBytes) {
    const { probe, failures } = await this.#probe(run, inputBytes);
    if (failures.length) {
      run.status = 'refused';
      run.error = { code: 'walls_failed', message: `The walls did not hold, so the agent did not start: ${failures.join('; ')}` };
      this.#seal(run, { probe, endedBy: 'refused' });
      return;
    }
    const outcome = await runAgent({
      planner,
      sandbox: this.sandbox,
      question,
      inputBytes,
      limits: this.agentLimits,
      onEvent: (e) => this.#emit(run, e),
    });
    if (planner.model) run.model = planner.model;
    run.answer = outcome.answer ? redact(outcome.answer, this.secrets) : null;
    this.#seal(run, {
      probe,
      executions: outcome.executions,
      usage: planner.label === 'llm' ? outcome.usage : null,
      modelRequests: planner.label === 'llm' ? outcome.modelRequests : 0,
      endedBy: outcome.endedBy,
      extraTexts: outcome.messages.map((m) => JSON.stringify(m)),
    });
    if (planner.label === 'llm') this.onInference(null);
  }

  async #directBody(run, code, inputBytes) {
    const { probe, failures } = await this.#probe(run, inputBytes);
    if (failures.length) {
      run.status = 'refused';
      run.error = { code: 'walls_failed', message: `The walls did not hold, so the code did not run: ${failures.join('; ')}` };
      this.#seal(run, { probe, endedBy: 'refused' });
      return;
    }
    this.#emit(run, { type: 'tool_call', tool: 'run_code', arguments: { code } });
    const result = await this.sandbox.run({ code, inputBytes });
    this.#emit(run, {
      type: 'tool_result',
      tool: 'run_code',
      content: JSON.stringify({ exit_reason: result.exit_reason, exit_code: result.exit_code, stdout: result.stdout.slice(0, 8000), stderr: result.stderr.slice(0, 8000) }),
    });
    this.#seal(run, { probe, executions: [{ ...result, code }], endedBy: 'direct_run_finished' });
  }

  #purge() {
    const cutoff = Date.now() - RUN_TTL_MS;
    for (const [id, run] of this.runs) {
      if (run.status !== 'running' && (run.startedAt < cutoff || this.runs.size > MAX_STORED_RUNS)) this.runs.delete(id);
    }
  }
}

export function publicRun(run) {
  return {
    id: run.id,
    kind: run.kind,
    planner: run.planner,
    model: run.model,
    status: run.status,
    request: run.request,
    events: run.events,
    answer: run.answer,
    error: run.error,
    ledger: run.ledger,
  };
}
