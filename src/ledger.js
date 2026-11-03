import { assessProbe } from './sandbox.js';

const summariseExecution = (e) => ({
  container: e.container,
  exit_reason: e.exit_reason,
  exit_code: e.exit_code,
  oom_killed: e.oom_killed,
  timed_out: e.timed_out,
  output_truncated: e.output_truncated,
  runtime_ms: e.runtime_ms,
  removed_verified: e.removed_verified,
  walls_passed: e.walls.length > 0 && e.walls.every((w) => w.ok),
});

/**
 * Builds the containment ledger. Every value comes from this run's docker inspect
 * output, its probe, its executions or its outputs. There are no literal results here.
 */
export function buildLedger({ runId, kind, planner, model, startedAt, finishedAt, probe, executions, usage, modelRequests, endedBy, scanTexts, secrets, hostLabel }) {
  const containers = [probe, ...executions].filter(Boolean);
  const observed = probe?.observed ?? null;
  const attempts = executions.flatMap((e) => e.attempts);
  const isNetwork = (a) => a.kind.startsWith('network.');
  const seen = secrets.filter(Boolean).filter((secret) => scanTexts.some((t) => String(t).includes(secret)));
  return {
    run_id: runId,
    kind,
    planner,
    model,
    host: hostLabel,
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    ended_by: endedBy,
    limits_applied: probe?.limits ?? null,
    walls: {
      source: 'docker inspect, read before each container started',
      checks: probe?.walls ?? [],
      containers_checked: containers.filter((c) => c.walls.length > 0).length,
      containers_failed: containers.filter((c) => c.walls.some((w) => !w.ok)).length,
    },
    probe: {
      source: 'probe program run in its own container with the same flags',
      observed,
      failures: assessProbe(observed),
    },
    secrets: {
      env_names_seen_in_sandbox: observed?.env_names ?? null,
      backend_secrets_checked: secrets.filter(Boolean).length,
      backend_secrets_found_in_outputs: seen.length,
    },
    attempts: {
      source: 'self-reported from inside the sandbox; the code under test can forge or bypass this',
      total: attempts.length,
      network: attempts.filter(isNetwork).length,
      network_succeeded: attempts.filter((a) => isNetwork(a) && a.outcome === 'succeeded').length,
      records: attempts,
    },
    executions: executions.map(summariseExecution),
    lifecycle: {
      containers_created: containers.length,
      containers_removed_verified: containers.filter((c) => c.removed_verified).length,
    },
    agent: {
      model_requests: modelRequests,
      tokens: usage,
    },
  };
}
