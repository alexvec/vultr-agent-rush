// Real Docker runs. Nothing is mocked. Requires: npm run sandbox:build
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { assessProbe, buildCreateArgs, DEFAULT_LIMITS, reapScratch, reapStale, Sandbox } from '../src/sandbox.js';

const sandbox = new Sandbox();
const quick = new Sandbox({ limits: { ...DEFAULT_LIMITS, wallClockMs: 2_500 } });

function leftovers() {
  return execFileSync('docker', ['ps', '-a', '--filter', 'label=padded-cell.sandbox=1', '--format', '{{.Names}}']).toString().trim();
}

after(() => {
  assert.equal(leftovers(), '', 'no sandbox container may survive the test run');
});

test('the image exists', async () => {
  assert.equal((await sandbox.available()).ok, true, 'run npm run sandbox:build first');
});

test('probe: measured walls hold, env is empty, the container is removed', async () => {
  const probe = await sandbox.probe();
  assert.equal(probe.started, true);
  assert.deepEqual(assessProbe(probe.observed), []);
  assert.deepEqual(probe.observed.env_names, []);
  assert.equal(probe.observed.pid1_environ_bytes, 0);
  assert.equal(probe.observed.status.CapEff, '0000000000000000');
  assert.ok(probe.walls.length > 15);
  assert.ok(probe.walls.every((w) => w.ok), JSON.stringify(probe.walls.filter((w) => !w.ok)));
  assert.equal(probe.removed_verified, true);
});

test('hostile code cannot reach the network', async () => {
  const code = `
import socket
results = {}
for label, target in {"public": ("1.1.1.1", 443), "metadata": ("169.254.169.254", 80), "dns": ("example.com", 443)}.items():
    try:
        socket.create_connection(target, timeout=2).close()
        results[label] = "CONNECTED"
    except OSError as exc:
        results[label] = type(exc).__name__
print(results)
`;
  const r = await sandbox.run({ code });
  assert.equal(r.exit_reason, 'completed', r.stderr);
  assert.doesNotMatch(r.stdout, /CONNECTED/);
  assert.match(r.stdout, /'public': '(OSError|TimeoutError)'/);
  assert.ok(r.attempts.some((a) => a.kind === 'network.connect' && a.outcome.startsWith('blocked')), JSON.stringify(r.attempts));
  assert.ok(!r.attempts.some((a) => a.outcome === 'succeeded' && a.kind.startsWith('network')));
  assert.equal(r.removed_verified, true);
});

test('control: a listener on the host sees the bridge container connect and never sees the sandbox', async () => {
  // Shows the network assertion can fail: the same client reaches the listener when the wall is off.
  let connections = 0;
  const server = net.createServer((socket) => { connections += 1; socket.destroy(); });
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  const { port } = server.address();
  const client = `
import socket
try:
    socket.create_connection(("host.docker.internal", ${port}), timeout=3).close()
    print("CONNECTED")
except OSError as exc:
    print("failed", exc)
`;
  try {
    const walled = await sandbox.run({ code: client });
    assert.doesNotMatch(walled.stdout, /CONNECTED/);
    assert.equal(connections, 0, 'the sandboxed client must not reach the host');

    const dir = mkdtempSync(path.join(tmpdir(), 'pc-control-'));
    writeFileSync(path.join(dir, 'client.py'), client);
    // Async on purpose: a sync spawn would block the event loop and the listener could never count.
    const control = await new Promise((resolve) => {
      execFile('docker', [
        'run', '--rm', '--pull', 'never', '--network', 'bridge',
        '--add-host', 'host.docker.internal:host-gateway',
        '-v', `${dir}:/code:ro`, 'padded-cell-sandbox:latest', '/usr/bin/python3', '/code/client.py',
      ], { encoding: 'utf8', timeout: 30_000 }, (_err, stdout, stderr) => resolve({ stdout, stderr }));
    });
    rmSync(dir, { recursive: true, force: true });
    assert.match(control.stdout, /CONNECTED/, `control should connect: ${control.stdout}${control.stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(connections >= 1, 'the control connection must reach the listener');
  } finally {
    server.close();
  }
});

test('hostile code cannot write to the root filesystem, the input or the code mount', async () => {
  const code = `
for path in ["/planted", "/etc/planted", "/usr/bin/planted", "/input/data", "/input/new", "/code/main.py"]:
    try:
        open(path, "w").write("x")
        print("WROTE", path)
    except OSError as exc:
        print("blocked", path, exc.strerror)
open("/tmp/ok", "w").write("scratch")
print("scratch", open("/tmp/ok").read())
print("input", open("/input/data").read())
`;
  const r = await sandbox.run({ code, inputBytes: Buffer.from('original') });
  assert.equal(r.exit_reason, 'completed', r.stderr);
  assert.doesNotMatch(r.stdout, /WROTE/);
  assert.match(r.stdout, /blocked \/planted Read-only file system/);
  assert.match(r.stdout, /scratch scratch/);
  assert.match(r.stdout, /input original/);
});

test('the scratch tmpfs refuses executables and has a size limit', async () => {
  const code = `
import os, subprocess
open("/tmp/x.sh", "w").write("#!/bin/sh\\necho EXECUTED\\n")
os.chmod("/tmp/x.sh", 0o755)
try:
    print(subprocess.run(["/tmp/x.sh"], capture_output=True).stdout)
except OSError as exc:
    print("exec blocked", exc.strerror)
try:
    with open("/tmp/big", "wb") as handle:
        while True:
            handle.write(b"x" * 1024 * 1024)
            handle.flush()
except OSError as exc:
    print("disk blocked", exc.strerror)
`;
  const r = await sandbox.run({ code });
  assert.doesNotMatch(r.stdout, /EXECUTED/);
  assert.match(r.stdout, /exec blocked Permission denied/);
  assert.match(r.stdout, /disk blocked No space left on device/);
});

test('secrets in the backend process do not enter the sandbox', async () => {
  process.env.VULTR_INFERENCE_API_KEY = 'canary-key-must-not-leak';
  try {
    const code = `
import os
print("env", dict(os.environ))
print("proc", open("/proc/self/environ", "rb").read())
print("pid1", open("/proc/1/environ", "rb").read())
`;
    const r = await sandbox.run({ code });
    assert.equal(r.exit_reason, 'completed', r.stderr);
    assert.doesNotMatch(r.stdout, /canary-key-must-not-leak/);
    assert.match(r.stdout, /env \{\}/);
    assert.match(r.stdout, /proc b''/);
    assert.match(r.stdout, /pid1 b''/);
  } finally {
    delete process.env.VULTR_INFERENCE_API_KEY;
  }
});

test('the docker socket is not reachable from the sandbox', async () => {
  const code = `
import os
print([p for p in ["/var/run/docker.sock", "/run/docker.sock"] if os.path.exists(p)])
print(os.getuid())
`;
  const r = await sandbox.run({ code });
  assert.match(r.stdout, /^\[\]\n65534\n$/);
});

test('memory bomb is killed by the memory limit', async () => {
  const r = await sandbox.run({ code: 'b = []\nwhile True:\n    b.append(bytearray(8 * 1024 * 1024))\n' });
  assert.equal(r.oom_killed, true);
  assert.equal(r.exit_code, 137);
  assert.equal(r.exit_reason, 'memory_limit_killed');
  assert.equal(r.removed_verified, true);
});

test('infinite loop is killed by the wall clock', async () => {
  const started = Date.now();
  const r = await quick.run({ code: 'while True:\n    pass\n' });
  assert.equal(r.timed_out, true);
  assert.equal(r.exit_reason, 'wall_clock_killed');
  assert.ok(Date.now() - started < 15_000);
  assert.equal(r.removed_verified, true);
});

test('fork bomb stops at the pids limit', async () => {
  const code = `
import os, time
count = 0
try:
    while True:
        if os.fork() == 0:
            time.sleep(30)
            os._exit(0)
        count += 1
except OSError as exc:
    print("refused after", count, exc.strerror, flush=True)
`;
  const r = await sandbox.run({ code });
  const match = r.stdout.match(/refused after (\d+) Resource temporarily unavailable/);
  assert.ok(match, r.stdout + r.stderr);
  assert.ok(Number(match[1]) < DEFAULT_LIMITS.pidsLimit);
  assert.equal(r.removed_verified, true);
});

test('output flood is cut off at the cap', async () => {
  const r = await sandbox.run({ code: 'while True:\n    print("A" * 1024)\n' });
  assert.equal(r.output_truncated, true);
  assert.equal(r.exit_reason, 'output_cap_killed');
  assert.ok(Buffer.byteLength(r.stdout) <= DEFAULT_LIMITS.outputBytes);
  assert.equal(r.removed_verified, true);
});

test('create arguments carry every wall flag and no secret or socket', () => {
  const args = buildCreateArgs({ image: 'i', name: 'n', limits: DEFAULT_LIMITS, inputDir: '/a', codeDir: '/b', command: ['x'] }).join(' ');
  for (const flag of ['--network none', '--read-only', '--cap-drop ALL', '--security-opt no-new-privileges', '--user 65534:65534', '--pids-limit', '--memory-swap', '--pull never']) {
    assert.ok(args.includes(flag), flag);
  }
  assert.doesNotMatch(args, /docker\.sock|--privileged|--env|-e /);
});

test('a container that fails policy is never started', async () => {
  const weaken = [
    ['network bridge', (args) => args.map((a, i) => (args[i - 1] === '--network' ? 'bridge' : a))],
    ['writable root', (args) => args.filter((a) => a !== '--read-only')],
    ['extra capability', (args) => ['create', '--cap-add', 'SYS_ADMIN', ...args.slice(1)]],
    ['secret in env', (args) => ['create', '--env', 'SECRET=x', ...args.slice(1)]],
    ['privileged', (args) => ['create', '--privileged', ...args.slice(1)]],
  ];
  for (const [label, mutate] of weaken) {
    const weakened = new Sandbox({ buildArgs: (opts) => mutate(buildCreateArgs(opts)) });
    const r = await weakened.run({ code: 'print("RAN")' });
    assert.equal(r.started, false, label);
    assert.equal(r.exit_reason, 'refused_policy_mismatch', label);
    assert.equal(r.stdout, '', label);
    assert.equal(r.removed_verified, true, label);
    assert.ok(r.walls.some((w) => !w.ok), label);
  }
});

test('the reaper removes old labelled containers and leaves others alone', async () => {
  const name = `padded-cell-stale-${process.pid}`;
  const unrelated = `pc-unrelated-${process.pid}`;
  execFileSync('docker', ['create', '--name', name, '--label', 'padded-cell.sandbox=1', '--label', 'padded-cell.created-ms=1', '--pull', 'never', 'padded-cell-sandbox:latest', 'true']);
  execFileSync('docker', ['create', '--name', unrelated, '--pull', 'never', 'padded-cell-sandbox:latest', 'true']);
  try {
    const removed = await reapStale(60_000);
    assert.ok(removed.includes(name));
    assert.ok(!removed.includes(unrelated));
    assert.equal(spawnSync('docker', ['inspect', '--type', 'container', name]).status, 1);
    assert.equal(spawnSync('docker', ['inspect', '--type', 'container', unrelated]).status, 0);
  } finally {
    spawnSync('docker', ['rm', '-f', name, unrelated]);
  }
});

test('the scratch reaper removes only old pc-run directories', async () => {
  const work = mkdtempSync(path.join(tmpdir(), 'pc-work-'));
  try {
    mkdirSync(path.join(work, 'pc-run-old'));
    mkdirSync(path.join(work, 'unrelated'));
    assert.deepEqual(await reapScratch(work, 60_000, Date.now() + 120_000), ['pc-run-old']);
    assert.deepEqual(readdirSync(work), ['unrelated']);
    assert.deepEqual(await reapScratch(work, 60_000), []);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('no web-facing artefact mounts the docker socket', () => {
  for (const file of ['deploy/provision.sh', 'deploy/padded-cell.service', 'sandbox/Dockerfile']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /-v [^ ]*docker\.sock/);
  }
});
