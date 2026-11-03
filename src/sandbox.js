// The only code path that executes untrusted code. Everything runs through
// `docker create` with the walls below, is inspected against policy before it
// starts, and is removed afterwards. There is deliberately no local-exec fallback.
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';

export const DEFAULT_LIMITS = Object.freeze({
  memoryBytes: 128 * 1024 * 1024,
  nanoCpus: 500_000_000,
  pidsLimit: 32,
  wallClockMs: 10_000,
  outputBytes: 64 * 1024,
  tmpfsBytes: 16 * 1024 * 1024,
});

const LABEL = 'padded-cell.sandbox';
const CREATED_LABEL = 'padded-cell.created-ms';
const AUDIT_MARK = '@@pc-audit@@ ';
const MAX_AUDIT = 200;
// Docker image ENV that may appear in config. The process env is still wiped by `env -i`.
const ALLOWED_CONFIG_ENV = new Set(['PATH']);
const LIFECYCLE_EVENTS = ['create', 'start', 'die', 'destroy'];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The docker CLI gets the minimum it needs, so nothing in the backend env can leak by accident.
function dockerEnv() {
  const env = {};
  for (const name of ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONFIG', 'DOCKER_CONTEXT']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return env;
}

export function docker(args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { env: dockerEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err.message) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input ?? '');
  });
}

/** Builds the `docker create` arguments. Exported so tests can assert on it. */
export function buildCreateArgs({ image, name, limits, inputDir, codeDir, command }) {
  return [
    'create',
    '--name', name,
    '--label', `${LABEL}=1`,
    '--label', `${CREATED_LABEL}=${Date.now()}`,
    '--pull', 'never',
    '--network', 'none',
    '--read-only',
    '--tmpfs', `/tmp:rw,noexec,nosuid,nodev,size=${limits.tmpfsBytes}`,
    '--memory', String(limits.memoryBytes),
    '--memory-swap', String(limits.memoryBytes),
    '--cpus', String(limits.nanoCpus / 1e9),
    '--pids-limit', String(limits.pidsLimit),
    '--ulimit', 'nofile=128:128',
    '--ulimit', 'core=0:0',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--user', '65534:65534',
    '--ipc', 'none',
    '--hostname', 'cell',
    '--workdir', '/tmp',
    '--log-driver', 'none',
    '--restart', 'no',
    '--oom-score-adj', '1000',
    '-v', `${inputDir}:/input:ro`,
    '-v', `${codeDir}:/code:ro`,
    image,
    '/usr/bin/env', '-i', ...command,
  ];
}

/**
 * Compares a container's `docker inspect` output with the policy. The result goes
 * into the ledger, and any failed check stops the container from starting.
 */
export function checkWalls(info, limits) {
  const host = info.HostConfig ?? {};
  const config = info.Config ?? {};
  const mounts = info.Mounts ?? [];
  const tmpfs = host.Tmpfs ?? {};
  const envNames = (config.Env ?? []).map((e) => e.split('=')[0]);
  const securityOpt = host.SecurityOpt ?? [];
  const allowedMounts = new Set(['/input', '/code']);
  const check = (wall, expected, actual) => ({
    wall,
    expected,
    actual,
    ok: JSON.stringify(expected) === JSON.stringify(actual),
  });
  return [
    check('network_mode', 'none', host.NetworkMode),
    check('read_only_root', true, host.ReadonlyRootfs),
    check('privileged', false, host.Privileged),
    check('cap_drop', ['ALL'], host.CapDrop),
    check('cap_add', [], host.CapAdd ?? []),
    check('no_new_privileges', true, securityOpt.includes('no-new-privileges')),
    check('seccomp_not_disabled', true, !securityOpt.some((o) => o.includes('seccomp=unconfined') || o.includes('seccomp:unconfined'))),
    check('user', '65534:65534', config.User),
    check('memory_bytes', limits.memoryBytes, host.Memory),
    check('memory_swap_bytes', limits.memoryBytes, host.MemorySwap),
    check('nano_cpus', limits.nanoCpus, host.NanoCpus),
    check('pids_limit', limits.pidsLimit, host.PidsLimit),
    check('ipc_mode', 'none', host.IpcMode),
    check('host_pid', false, host.PidMode === 'host'),
    check('devices', [], host.Devices ?? []),
    check('log_driver', 'none', host.LogConfig?.Type),
    check('scratch_noexec_tmpfs', true, Object.keys(tmpfs).join() === '/tmp' && tmpfs['/tmp'].includes('noexec') && tmpfs['/tmp'].includes(`size=${limits.tmpfsBytes}`)),
    check('config_env_names', [], envNames.filter((n) => !ALLOWED_CONFIG_ENV.has(n))),
    check('mounts_read_only', [], mounts.filter((m) => m.Type !== 'bind' || m.RW !== false || !allowedMounts.has(m.Destination)).map((m) => m.Destination)),
    check('docker_socket_mounted', false, mounts.some((m) => String(m.Source).includes('docker.sock') || String(m.Destination).includes('docker.sock'))),
  ];
}

/** Separates self-reported audit lines from the real stderr. */
export function splitAudit(stderr) {
  const attempts = [];
  const kept = [];
  for (const line of stderr.split('\n')) {
    if (line.startsWith(AUDIT_MARK)) {
      if (attempts.length < MAX_AUDIT) {
        try {
          const parsed = JSON.parse(line.slice(AUDIT_MARK.length));
          attempts.push({ kind: String(parsed.kind), target: String(parsed.target), outcome: String(parsed.outcome) });
        } catch { /* a malformed line is simply not recorded */ }
      }
    } else {
      kept.push(line);
    }
  }
  return { attempts, stderr: kept.join('\n') };
}

export class Sandbox {
  constructor({ image = 'padded-cell-sandbox:latest', limits = DEFAULT_LIMITS, workDir = process.env.PADDED_CELL_WORK_DIR || tmpdir(), buildArgs = buildCreateArgs } = {}) {
    this.image = image;
    this.limits = { ...limits };
    this.workDir = workDir;
    this.buildArgs = buildArgs;
  }

  async available() {
    const res = await docker(['image', 'inspect', '--format', '{{.Id}}', this.image], { timeoutMs: 10_000 });
    return res.code === 0 ? { ok: true, imageId: res.stdout.trim() } : { ok: false, reason: res.stderr.trim().slice(0, 200) };
  }

  /** Runs the wall probe in a container with identical flags. Returns measured facts. */
  async probe({ inputBytes = Buffer.alloc(0) } = {}) {
    const out = await this.#execute({
      command: ['/usr/bin/python3', '-I', '-B', '/opt/cell/probe.py'],
      code: '',
      inputBytes,
    });
    let observed = null;
    try { observed = JSON.parse(out.stdout.trim()); } catch { /* reported below */ }
    return { ...out, observed };
  }

  /** Runs untrusted Python with `inputBytes` available at /input/data. */
  run({ code, inputBytes = Buffer.alloc(0) }) {
    return this.#execute({
      command: ['/usr/bin/python3', '-I', '-B', '/opt/cell/runner.py', '/code/main.py'],
      code,
      inputBytes,
    });
  }

  async #execute({ command, code, inputBytes }) {
    const scratch = await this.#prepare(code, inputBytes);
    const name = `padded-cell-${randomBytes(8).toString('hex')}`;
    const startedAt = Date.now();
    let result;
    let removal = { gone: false, inspect: null };
    try {
      result = await this.#runContainer(name, scratch, command);
    } finally {
      removal = await this.#remove(name);
      await rm(scratch.root, { recursive: true, force: true });
    }
    const runtimeMs = Date.now() - startedAt;
    // Read last, because the destroy event only exists once the container has been removed.
    const events = await this.#lifecycleEvents(name, startedAt);
    return {
      ...result,
      removed_verified: removal.gone,
      runtime_ms: runtimeMs,
      evidence: { ...result.evidence, events, post_removal_inspect: removal.inspect },
    };
  }

  async #runContainer(name, scratch, command) {
    const base = {
      container: name,
      image: this.image,
      limits: { ...this.limits },
      stdout: '',
      stderr: '',
      attempts: [],
      walls: [],
      started: false,
      exit_code: null,
      oom_killed: false,
      timed_out: false,
      output_truncated: false,
      evidence: { source: 'host side: docker CLI run by the backend, outside the container', inspect_before_start: null, final_state: null, stdout: null, stderr: null },
    };
    const created = await docker(this.buildArgs({
      image: this.image,
      name,
      limits: this.limits,
      inputDir: scratch.inputDir,
      codeDir: scratch.codeDir,
      command,
    }));
    if (created.code !== 0) {
      return { ...base, exit_reason: 'create_failed', error: created.stderr.trim().slice(0, 400) };
    }
    const inspected = await this.#inspect(name);
    const walls = inspected ? checkWalls(inspected, this.limits) : [];
    base.walls = walls;
    base.evidence.inspect_before_start = inspected;
    if (!inspected || walls.some((w) => !w.ok)) {
      return { ...base, exit_reason: 'refused_policy_mismatch', error: 'Container did not match the wall policy, so it was never started.' };
    }
    const running = await this.#attach(name);
    const after = await this.#inspect(name);
    const state = after?.State ?? {};
    const split = splitAudit(running.stderr);
    const result = {
      ...base,
      started: true,
      stdout: running.stdout,
      stderr: split.stderr,
      attempts: split.attempts,
      exit_code: state.ExitCode ?? null,
      oom_killed: state.OOMKilled === true,
      timed_out: running.timedOut,
      output_truncated: running.truncated,
      evidence: {
        ...base.evidence,
        final_state: state,
        stdout: { sha256: sha256(running.stdoutBytes), bytes: running.stdoutBytes.length, base64: running.stdoutBytes.toString('base64') },
        stderr: { sha256: sha256(running.stderrBytes), bytes: running.stderrBytes.length },
      },
    };
    result.exit_reason = exitReason(result);
    return result;
  }

  async #prepare(code, inputBytes) {
    await mkdir(this.workDir, { recursive: true });
    const root = await mkdtemp(path.join(this.workDir, 'pc-run-'));
    const inputDir = path.join(root, 'input');
    const codeDir = path.join(root, 'code');
    await mkdir(inputDir);
    await mkdir(codeDir);
    await writeFile(path.join(inputDir, 'data'), inputBytes);
    await writeFile(path.join(codeDir, 'main.py'), code);
    // The container runs as nobody, and the mounts are read-only, so read access is all it gets.
    await chmod(root, 0o755);
    await chmod(inputDir, 0o755);
    await chmod(codeDir, 0o755);
    await chmod(path.join(inputDir, 'data'), 0o444);
    await chmod(path.join(codeDir, 'main.py'), 0o444);
    return { root, inputDir, codeDir };
  }

  async #inspect(name) {
    const res = await docker(['inspect', name]);
    if (res.code !== 0) return null;
    try { return JSON.parse(res.stdout)[0]; } catch { return null; }
  }

  #attach(name) {
    return new Promise((resolve) => {
      const child = spawn('docker', ['start', '--attach', name], { env: dockerEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
      const cap = this.limits.outputBytes;
      const chunks = { stdout: [], stderr: [] };
      const sizes = { stdout: 0, stderr: 0 };
      let truncated = false;
      let timedOut = false;
      let killing = false;
      const kill = () => {
        if (killing) return;
        killing = true;
        docker(['kill', name], { timeoutMs: 10_000 });
      };
      const collect = (stream) => (data) => {
        const room = cap - sizes[stream];
        if (data.length > room) {
          truncated = true;
          if (room > 0) chunks[stream].push(data.subarray(0, room));
          sizes[stream] = cap;
          kill();
        } else {
          chunks[stream].push(data);
          sizes[stream] += data.length;
        }
      };
      child.stdout.on('data', collect('stdout'));
      child.stderr.on('data', collect('stderr'));
      const wallClock = setTimeout(() => { timedOut = true; kill(); }, this.limits.wallClockMs);
      // If the attach client itself hangs, the run still has to end.
      const backstop = setTimeout(() => child.kill('SIGKILL'), this.limits.wallClockMs + 15_000);
      child.on('close', () => {
        clearTimeout(wallClock);
        clearTimeout(backstop);
        const stdoutBytes = Buffer.concat(chunks.stdout);
        const stderrBytes = Buffer.concat(chunks.stderr);
        resolve({
          stdoutBytes,
          stderrBytes,
          stdout: stdoutBytes.toString('utf8'),
          stderr: stderrBytes.toString('utf8'),
          truncated,
          timedOut,
        });
      });
      child.on('error', () => { /* `close` follows and resolves */ });
    });
  }

  async #remove(name) {
    await docker(['rm', '--force', '--volumes', name]);
    const after = await docker(['inspect', '--type', 'container', name]);
    // Only "no such container" counts as gone. A failed or unreachable daemon does not.
    const gone = after.code !== 0 && /no such/i.test(after.stderr);
    return {
      gone,
      inspect: {
        command: `docker inspect --type container ${name}`,
        exit_code: after.code,
        stderr: after.stderr.trim().slice(0, 300),
        failed_as_expected: gone,
      },
    };
  }

  /** Reads this container's lifecycle from the Docker daemon's event log, by its unique name. */
  async #lifecycleEvents(name, startedAt) {
    const since = ((startedAt - 60_000) / 1000).toFixed(3);
    const query = async (marginMs) => {
      const until = ((Date.now() + marginMs) / 1000).toFixed(3);
      const res = await docker(['events', '--since', since, '--until', until, '--filter', 'type=container', '--filter', `container=${name}`, '--format', '{{json .}}']);
      return { res, raw: parseEvents(res.stdout) };
    };
    // A short margin keeps runs quick. The second try covers a daemon clock ahead of this host's.
    let { res, raw } = await query(300);
    if (!raw.some((e) => e.action === 'destroy')) ({ res, raw } = await query(3_000));
    const first = (action) => raw.find((e) => e.action === action)?.at ?? 'not observed';
    return {
      source: 'docker events, read from the daemon after removal',
      read_ok: res.code === 0,
      ...Object.fromEntries(LIFECYCLE_EVENTS.map((action) => [action, first(action)])),
      raw,
    };
  }
}

/** Parses `docker events --format '{{json .}}'`. timeNano stays a string, since it does not fit a JS number. */
export function parseEvents(stdout) {
  const events = [];
  for (const line of stdout.split('\n').filter(Boolean)) {
    try {
      const parsed = JSON.parse(line);
      const timeNano = line.match(/"timeNano":(\d+)/)?.[1] ?? null;
      const attributes = parsed.Actor?.Attributes ?? {};
      events.push({
        action: String(parsed.Action ?? parsed.status),
        at: timeNano ? new Date(Number(timeNano.slice(0, -6))).toISOString() : 'not returned',
        time_nano: timeNano ?? 'not returned',
        ...(attributes.exitCode === undefined ? {} : { exit_code: attributes.exitCode }),
      });
    } catch { /* an unreadable line is not recorded */ }
  }
  return events;
}

export function exitReason(r) {
  if (r.timed_out) return 'wall_clock_killed';
  if (r.output_truncated) return 'output_cap_killed';
  if (r.oom_killed) return 'memory_limit_killed';
  if (r.exit_code === 0) return 'completed';
  if (r.exit_code === 137) return 'killed_sigkill';
  return 'nonzero_exit';
}

/** Removes sandbox containers older than maxAgeMs. It only touches containers carrying our label. */
export async function reapStale(maxAgeMs, now = Date.now()) {
  const res = await docker(['ps', '--all', '--filter', `label=${LABEL}=1`, '--format', `{{.Names}} {{.Label "${CREATED_LABEL}"}}`]);
  if (res.code !== 0) return [];
  const removed = [];
  for (const line of res.stdout.split('\n').filter(Boolean)) {
    const [name, created] = line.split(' ');
    if (now - Number(created) > maxAgeMs) {
      await docker(['rm', '--force', '--volumes', name]);
      removed.push(name);
    }
  }
  return removed;
}

/** Removes scratch directories a crashed backend left behind, since they can hold uploaded files. */
export async function reapScratch(workDir, maxAgeMs, now = Date.now()) {
  let names = [];
  try { names = await readdir(workDir); } catch { return []; }
  const removed = [];
  for (const name of names.filter((n) => n.startsWith('pc-run-'))) {
    const full = path.join(workDir, name);
    try {
      if (now - (await stat(full)).mtimeMs > maxAgeMs) {
        await rm(full, { recursive: true, force: true });
        removed.push(name);
      }
    } catch { /* already gone */ }
  }
  return removed;
}

/** Decides from measured probe output whether the walls hold. Returns the failures, if any. */
export function assessProbe(observed) {
  if (!observed) return ['probe produced no readable output'];
  const failures = [];
  if (observed.env_names?.length) failures.push(`environment not empty: ${observed.env_names.join(',')}`);
  if (observed.pid1_environ_bytes) failures.push('pid 1 has a non-empty environment');
  const outward = (observed.interfaces_up ?? []).filter((n) => n !== 'lo');
  if (outward.length) failures.push(`non-loopback interface up: ${outward.join(',')}`);
  if (observed.route_count) failures.push(`routes present: ${observed.route_count}`);
  for (const key of ['tcp_public_ip', 'tcp_metadata_ip', 'dns_lookup', 'write_root', 'write_input']) {
    if (observed[key]?.ok !== false) failures.push(`${key} was not blocked`);
  }
  if (observed.write_scratch?.ok !== true) failures.push('scratch tmpfs is not writable');
  if (observed.docker_socket_present !== false) failures.push('docker socket visible');
  if (!/^0+$/.test(observed.status?.CapEff ?? '')) failures.push('effective capabilities not zero');
  if (observed.status?.NoNewPrivs !== '1') failures.push('no_new_privs not set');
  if (observed.status?.Seccomp !== '2') failures.push('seccomp filter not active');
  if (!String(observed.status?.Uid ?? '').startsWith('65534')) failures.push('not running as uid 65534');
  return failures;
}
