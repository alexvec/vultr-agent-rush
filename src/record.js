import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds the function that removes secrets and local paths from a record. Docker Desktop reports a bind source under /host_mnt/private. */
export function makeScrubber({ secrets = [], workDir = null } = {}) {
  const rules = [];
  for (const secret of secrets.filter(Boolean)) rules.push([new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]']);
  // Only the prefix of our own scratch directories. The work dir can be /tmp, and /tmp is also a path inside the container.
  if (workDir && workDir.length > 1) {
    rules.push([new RegExp(`(/host_mnt)?(/private)?${escapeRegExp(workDir.replace(/\/+$/, ''))}(?=/pc-run-)`, 'g'), '<work-dir>']);
  }
  const home = homedir();
  if (home && home.length > 1) rules.push([new RegExp(`(/host_mnt)?${escapeRegExp(home)}`, 'g'), '<home>']);
  return (text) => rules.reduce((out, [pattern, value]) => out.replace(pattern, value), String(text));
}

function describeContainer(c, role, scrub) {
  const evidence = c.evidence ?? {};
  const stdoutClean = scrub(c.stdout ?? '') === (c.stdout ?? '');
  const entry = {
    role,
    container: c.container,
    image: c.image,
    started: c.started,
    exit_reason: c.exit_reason,
    measured_outside_the_container: {
      source: evidence.source,
      inspect_before_start_raw: evidence.inspect_before_start ?? null,
      wall_checks_against_that_inspect: c.walls,
      final_state_raw: evidence.final_state ?? null,
      events: evidence.events ?? null,
      post_removal_inspect: evidence.post_removal_inspect ?? null,
      wall_clock_killed_by_backend: c.timed_out,
      output_cap_killed_by_backend: c.output_truncated,
      runtime_ms: c.runtime_ms,
    },
    output_written_by_the_code: {
      note: 'The bytes and their hash are taken on the host. The content comes from the code in the container.',
      stdout_sha256: evidence.stdout?.sha256 ?? null,
      stdout_bytes: evidence.stdout?.bytes ?? 0,
      // base64 keeps the exact bytes, so `base64 -d | sha256sum` reproduces the hash.
      stdout_base64: stdoutClean ? evidence.stdout?.base64 ?? null : 'withheld: the output contains a backend secret or a local path',
      stdout_text: c.stdout,
      stderr_sha256: evidence.stderr?.sha256 ?? null,
      stderr_text_without_audit_lines: c.stderr,
    },
  };
  if (c.code !== undefined) {
    entry.code = { source: c.code_source, step: c.step ?? null, sha256: sha256(c.code), text: c.code };
  }
  return entry;
}

/**
 * Every claim is computed from values the backend read itself. `attempts` is not an
 * argument here, so nothing the code under test reports can change a claim.
 */
export function containmentClaims({ containers, secretScan, canary }) {
  const inspected = containers.map((c) => c.evidence?.inspect_before_start ?? null);
  const everyContainer = (test) => containers.length > 0 && containers.every(test);
  const canaryHits = canary?.hits_during_run;
  return [
    {
      claim: 'Every container matched the wall policy in docker inspect before it could start',
      holds: everyContainer((c) => c.walls.length > 0 && c.walls.every((w) => w.ok)),
      evidence: 'containers[].measured_outside_the_container.wall_checks_against_that_inspect',
    },
    {
      claim: 'Every container was created with network mode none',
      holds: inspected.length > 0 && inspected.every((i) => i?.HostConfig?.NetworkMode === 'none'),
      evidence: 'inspect_before_start_raw.HostConfig.NetworkMode',
    },
    {
      claim: 'Every container is gone: inspecting it by name fails with "no such container"',
      holds: everyContainer((c) => c.evidence?.post_removal_inspect?.failed_as_expected === true),
      evidence: 'containers[].measured_outside_the_container.post_removal_inspect',
    },
    {
      claim: 'The Docker daemon logged a destroy event for every container',
      holds: everyContainer((c) => /^\d{4}-/.test(c.evidence?.events?.destroy ?? '')),
      evidence: 'containers[].measured_outside_the_container.events',
    },
    {
      claim: 'No backend secret appears in any output',
      holds: secretScan.backend_secrets_found_in_outputs === 0,
      evidence: 'secret_scan',
    },
    {
      claim: 'The canary listener counted no connection during this run',
      holds: typeof canaryHits === 'number' ? canaryHits === 0 : 'not measured',
      strength: 'weak evidence, see canary.note',
      evidence: 'canary',
    },
  ];
}

/** The downloadable record for one run. Unsigned: the hashes let a judge compare it with files they hold. */
export function buildRecord(run, { deployment, host, deploymentBasis, commit, track, inferenceBaseUrl, secrets, workDir }) {
  const scrub = makeScrubber({ secrets, workDir });
  const ledger = run.ledger;
  const executions = run.executions ?? [];
  const containers = [
    ...(run.probe ? [describeContainer(run.probe, 'probe', scrub)] : []),
    ...executions.map((e) => describeContainer(e, 'execution', scrub)),
  ];
  const last = executions.filter((e) => e.started).at(-1);
  const modelCode = executions.filter((e) => e.code_source === 'model_tool_call');
  const lastOutput = last ? describeContainer(last, 'execution', scrub).output_written_by_the_code : null;
  const secretScan = ledger?.secrets ?? { backend_secrets_found_in_outputs: 'not measured' };
  const record = {
    record_version: 1,
    generated_at: new Date().toISOString(),
    not_signed: 'This file is not signed or tamper-proof. The hashes let you check it against files you hold. They do not prove the server told the truth, and the host-side values come from docker commands the same backend ran.',
    run_id: run.id,
    kind: run.kind,
    status: run.status,
    planner: run.planner,
    started_at: new Date(run.startedAt).toISOString(),
    finished_at: ledger?.finished_at ?? 'not finished',
    ended_by: ledger?.ended_by ?? 'not finished',
    error: run.error,
    deployment,
    deployment_basis: deploymentBasis,
    host,
    commit,
    track,
    request: run.request,
    input: run.input,
    output: lastOutput
      ? { of: 'stdout of the last container that ran untrusted code', sha256: lastOutput.stdout_sha256, bytes: lastOutput.stdout_bytes, base64: lastOutput.stdout_base64 }
      : { of: 'nothing: no untrusted code ran', sha256: 'not applicable' },
    model_code: modelCode.length
      ? modelCode.map((e) => ({ step: e.step, sha256: sha256(e.code), text: e.code }))
      : 'not present: no model wrote code in this run',
    inference: run.planner === 'llm'
      ? { base_url: inferenceBaseUrl, calls: run.modelCalls ?? [], transcript: run.messages ?? [], answer: run.answer }
      : 'not used: no model ran',
    containment_claims: {
      basis: 'Computed from host-side values only. Nothing in self_reported_by_code_in_sandbox feeds these.',
      claims: containmentClaims({ containers: [run.probe, ...executions].filter(Boolean), secretScan, canary: ledger?.canary }),
    },
    containers,
    canary: ledger?.canary ?? 'not measured',
    secret_scan: secretScan,
    probe_inside_its_own_container: {
      source: 'Our probe program, inside a separate container with the same flags, before any untrusted code. It is not host-side evidence.',
      observed: ledger?.probe?.observed ?? null,
      failures: ledger?.probe?.failures ?? null,
    },
    self_reported_by_code_in_sandbox: {
      label: 'SELF-REPORTED. Written by a wrapper in the same process as the code under test, which can forge or hide it. It explains what happened and feeds no containment claim, count or headline.',
      counts_toward_containment_claims: false,
      attempts: ledger?.attempts?.records ?? [],
    },
    scrubbed: 'Backend secrets become [REDACTED]. The backend scratch directory becomes <work-dir> and the home directory becomes <home>, including inside the raw docker inspect. Nothing else in the raw inspect is changed.',
  };
  return JSON.parse(scrub(JSON.stringify(record)));
}
