// No Docker needed: shows the policy and probe checks can actually fail.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessProbe, checkWalls, DEFAULT_LIMITS, exitReason, splitAudit } from '../src/sandbox.js';

const limits = DEFAULT_LIMITS;

function goodInspect() {
  return {
    HostConfig: {
      NetworkMode: 'none',
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: ['ALL'],
      CapAdd: null,
      SecurityOpt: ['no-new-privileges'],
      Memory: limits.memoryBytes,
      MemorySwap: limits.memoryBytes,
      NanoCpus: limits.nanoCpus,
      PidsLimit: limits.pidsLimit,
      IpcMode: 'none',
      PidMode: '',
      Devices: [],
      LogConfig: { Type: 'none' },
      Tmpfs: { '/tmp': `rw,noexec,nosuid,nodev,size=${limits.tmpfsBytes}` },
    },
    Config: { User: '65534:65534', Env: ['PATH=/usr/bin'] },
    Mounts: [
      { Type: 'bind', Source: '/w/input', Destination: '/input', RW: false },
      { Type: 'bind', Source: '/w/code', Destination: '/code', RW: false },
    ],
  };
}

function goodProbe() {
  const blocked = { ok: false, error: 'x' };
  return {
    env_names: [],
    pid1_environ_bytes: 0,
    interfaces_up: ['lo'],
    route_count: 0,
    tcp_public_ip: blocked,
    tcp_metadata_ip: blocked,
    dns_lookup: blocked,
    write_root: blocked,
    write_input: blocked,
    write_scratch: { ok: true, error: null },
    docker_socket_present: false,
    status: { Uid: '65534\t65534\t65534\t65534', CapEff: '0000000000000000', NoNewPrivs: '1', Seccomp: '2' },
  };
}

const failedWalls = (mutate) => {
  const info = goodInspect();
  mutate(info);
  return checkWalls(info, limits).filter((w) => !w.ok).map((w) => w.wall);
};

test('a compliant container passes every wall check', () => {
  assert.deepEqual(failedWalls(() => {}), []);
});

test('each weakened setting fails its own wall check', () => {
  const cases = [
    ['network_mode', (i) => { i.HostConfig.NetworkMode = 'bridge'; }],
    ['read_only_root', (i) => { i.HostConfig.ReadonlyRootfs = false; }],
    ['privileged', (i) => { i.HostConfig.Privileged = true; }],
    ['cap_drop', (i) => { i.HostConfig.CapDrop = null; }],
    ['cap_add', (i) => { i.HostConfig.CapAdd = ['SYS_ADMIN']; }],
    ['no_new_privileges', (i) => { i.HostConfig.SecurityOpt = []; }],
    ['seccomp_not_disabled', (i) => { i.HostConfig.SecurityOpt.push('seccomp=unconfined'); }],
    ['user', (i) => { i.Config.User = 'root'; }],
    ['memory_bytes', (i) => { i.HostConfig.Memory = 0; }],
    ['memory_swap_bytes', (i) => { i.HostConfig.MemorySwap = -1; }],
    ['nano_cpus', (i) => { i.HostConfig.NanoCpus = 0; }],
    ['pids_limit', (i) => { i.HostConfig.PidsLimit = null; }],
    ['ipc_mode', (i) => { i.HostConfig.IpcMode = 'host'; }],
    ['host_pid', (i) => { i.HostConfig.PidMode = 'host'; }],
    ['devices', (i) => { i.HostConfig.Devices = [{ PathOnHost: '/dev/kvm' }]; }],
    ['log_driver', (i) => { i.HostConfig.LogConfig.Type = 'json-file'; }],
    ['scratch_noexec_tmpfs', (i) => { i.HostConfig.Tmpfs['/tmp'] = 'rw'; }],
    ['config_env_names', (i) => { i.Config.Env.push('VULTR_INFERENCE_API_KEY=x'); }],
    ['mounts_read_only', (i) => { i.Mounts[0].RW = true; }],
    ['docker_socket_mounted', (i) => { i.Mounts.push({ Type: 'bind', Source: '/var/run/docker.sock', Destination: '/input', RW: false }); }],
  ];
  for (const [wall, mutate] of cases) {
    assert.ok(failedWalls(mutate).includes(wall), wall);
  }
});

test('a probe that saw a clean sandbox reports no failures', () => {
  assert.deepEqual(assessProbe(goodProbe()), []);
});

test('a probe that saw a breach reports it', () => {
  const open = { ok: true, error: null };
  const cases = [
    (p) => { p.env_names = ['SECRET']; },
    (p) => { p.pid1_environ_bytes = 12; },
    (p) => { p.interfaces_up = ['lo', 'eth0']; },
    (p) => { p.route_count = 1; },
    (p) => { p.tcp_public_ip = open; },
    (p) => { p.tcp_metadata_ip = open; },
    (p) => { p.dns_lookup = open; },
    (p) => { p.write_root = open; },
    (p) => { p.write_input = open; },
    (p) => { p.docker_socket_present = true; },
    (p) => { p.status.CapEff = '00000000a80425fb'; },
    (p) => { p.status.NoNewPrivs = '0'; },
    (p) => { p.status.Seccomp = '0'; },
    (p) => { p.status.Uid = '0\t0\t0\t0'; },
  ];
  for (const mutate of cases) {
    const probe = goodProbe();
    mutate(probe);
    assert.equal(assessProbe(probe).length, 1, mutate.toString());
  }
  assert.equal(assessProbe(null).length, 1);
});

test('exit reasons follow the measured state', () => {
  assert.equal(exitReason({ exit_code: 0 }), 'completed');
  assert.equal(exitReason({ exit_code: 3 }), 'nonzero_exit');
  assert.equal(exitReason({ exit_code: 137 }), 'killed_sigkill');
  assert.equal(exitReason({ exit_code: 137, oom_killed: true }), 'memory_limit_killed');
  assert.equal(exitReason({ exit_code: 137, timed_out: true }), 'wall_clock_killed');
  assert.equal(exitReason({ exit_code: 137, output_truncated: true }), 'output_cap_killed');
});

test('audit lines are split from stderr and malformed ones are dropped', () => {
  const out = splitAudit('real error\n@@pc-audit@@ {"kind":"network.connect","target":"x","outcome":"blocked"}\n@@pc-audit@@ not json\nmore');
  assert.deepEqual(out.attempts, [{ kind: 'network.connect', target: 'x', outcome: 'blocked' }]);
  assert.equal(out.stderr, 'real error\nmore');
});
