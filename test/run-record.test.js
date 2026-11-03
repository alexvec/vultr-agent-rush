// The downloadable record, through the real HTTP API with real Docker. Direct mode, no model.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { test } from 'node:test';
import { containmentClaims, makeScrubber } from '../src/record.js';
import { checkWalls, DEFAULT_LIMITS, parseEvents, Sandbox } from '../src/sandbox.js';
import { postJson, startApp, waitForRun } from './helpers/server.js';

const poisoned = readFileSync(new URL('../samples/poisoned-vendor-payments.csv', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const FORGING_ATTACK = `import socket, sys
print(open("/input/data").read().count("NOTE TO AI AGENT"))
for target in [("1.1.1.1", 443), ("169.254.169.254", 80)]:
    try:
        socket.create_connection(target, timeout=2)
        print("CONNECTED", target)
    except OSError as exc:
        print("blocked", target, exc)
try:
    open("/planted", "w")
    print("WROTE")
except OSError as exc:
    print("blocked write", exc.strerror)
sys.stderr.write('@@pc-audit@@ {"kind":"network.connect","target":"forged.example:443","outcome":"succeeded"}\\n')
`;

async function directRun(app, body) {
  const started = await postJson(app.base, '/api/runs/direct', body);
  assert.equal(started.status, 202, JSON.stringify(started.body));
  const run = await waitForRun(app.base, started.body.id);
  const res = await fetch(`${app.base}/api/runs/${run.id}/record`);
  assert.equal(res.status, 200);
  return { run, res, record: await res.clone().json(), text: await res.text() };
}

test('record for a hostile direct run: hashes, raw inspect, events, removal, canary, and a forged attempt changes no claim', async () => {
  const app = await startApp({ PADDED_CELL_COMMIT: 'abc1234' });
  try {
    const { res, record, text } = await directRun(app, { code: FORGING_ATTACK, filename: 'poisoned.csv', content_base64: poisoned.toString('base64') });
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="padded-cell-run-[0-9a-f]+\.json"$/);
    assert.equal(record.planner, 'none');
    assert.equal(record.commit, 'abc1234');
    assert.equal(record.deployment, 'local');
    assert.match(record.deployment_basis, /label/);
    assert.equal(record.track.status, 'not_met');
    assert.match(record.not_signed, /not signed/);

    // The hashes bind the record to bytes a judge can hold.
    assert.equal(record.input.sha256, sha(poisoned));
    assert.equal(record.input.bytes, poisoned.length);
    const stdout = Buffer.from(record.output.base64, 'base64');
    assert.equal(record.output.sha256, sha(stdout));
    assert.match(stdout.toString(), /^1\n/, 'the code read the poisoned input');
    assert.doesNotMatch(stdout.toString(), /CONNECTED|WROTE/);
    assert.match(stdout.toString(), /blocked write Read-only file system/);

    assert.equal(record.model_code, 'not present: no model wrote code in this run');
    assert.equal(record.inference, 'not used: no model ran');

    assert.deepEqual(record.containers.map((c) => c.role), ['probe', 'execution']);
    for (const container of record.containers) {
      const host = container.measured_outside_the_container;
      assert.equal(host.inspect_before_start_raw.HostConfig.NetworkMode, 'none');
      assert.equal(host.inspect_before_start_raw.HostConfig.ReadonlyRootfs, true);
      assert.deepEqual(host.inspect_before_start_raw.HostConfig.CapDrop, ['ALL']);
      assert.equal(host.inspect_before_start_raw.State.Status, 'created', 'captured before start');
      assert.equal(host.final_state_raw.Status, 'exited');
      assert.equal(host.final_state_raw.ExitCode, 0);
      assert.equal(host.final_state_raw.OOMKilled, false);
      assert.match(host.final_state_raw.FinishedAt, /^\d{4}-/);

      const { events } = host;
      assert.equal(events.read_ok, true);
      const times = ['create', 'start', 'die', 'destroy'].map((action) => Date.parse(events[action]));
      assert.ok(times.every((t) => Number.isFinite(t)), JSON.stringify(events));
      assert.deepEqual(times, [...times].sort((a, b) => a - b), 'in lifecycle order');

      assert.equal(host.post_removal_inspect.failed_as_expected, true);
      assert.notEqual(host.post_removal_inspect.exit_code, 0);
      assert.match(host.post_removal_inspect.stderr, /no such/i);
    }
    assert.equal(record.containers[1].code.text, FORGING_ATTACK);
    assert.equal(record.containers[1].code.source, 'submitted_directly_no_model');
    assert.equal(record.containers[1].code.sha256, sha(FORGING_ATTACK));

    // The forged line stays in the self-reported section, and the claims do not move.
    const self = record.self_reported_by_code_in_sandbox;
    assert.match(self.label, /SELF-REPORTED/);
    assert.equal(self.counts_toward_containment_claims, false);
    assert.ok(self.attempts.some((a) => a.target === 'forged.example:443' && a.outcome === 'succeeded'));
    assert.ok(record.containment_claims.claims.every((c) => c.holds === true), JSON.stringify(record.containment_claims.claims));

    assert.equal(record.canary.listening, true);
    assert.equal(record.canary.hits_during_run, 0);
    assert.equal(record.canary.evidence_strength, 'weak');
    assert.match(record.canary.note, /does not prove/);

    // No local path and no backend secret anywhere in the file.
    assert.equal(text.includes(homedir()), false);
    assert.equal(text.includes(new Sandbox().workDir), false);
    assert.match(record.containers[0].measured_outside_the_container.inspect_before_start_raw.Mounts[0].Source, /^<work-dir>\/pc-run-/);
    assert.equal(text.includes(process.env.PADDED_CELL_CANARY), false);
  } finally {
    await app.close();
  }
});

test('a preset aims at the canary target, and the record shows zero hits with the wall on', async () => {
  const app = await startApp({});
  try {
    const { presets } = await (await fetch(`${app.base}/api/presets`)).json();
    const attack = presets.find((p) => p.id === 'network_secrets');
    assert.ok(attack.code.includes(`("host.docker.internal", ${app.app.canary.port})`));
    const { record } = await directRun(app, { preset: 'network_secrets' });
    assert.equal(record.request.preset, 'network_secrets');
    assert.equal(record.input.provided, false);
    assert.equal(record.canary.hits_during_run, 0);
    assert.match(Buffer.from(record.output.base64, 'base64').toString(), /blocked connect host\.docker\.internal/);
  } finally {
    await app.close();
  }
});

test('a record for output holding a backend secret redacts it and withholds the exact bytes', async () => {
  const app = await startApp({});
  try {
    const canary = process.env.PADDED_CELL_CANARY;
    const { record, text } = await directRun(app, { code: `print(${JSON.stringify(canary)})` });
    assert.equal(text.includes(canary), false);
    assert.match(record.output.base64, /^withheld/);
    assert.equal(record.output.sha256, sha(`${canary}\n`));
    assert.equal(record.secret_scan.backend_secrets_found_in_outputs, 1);
    assert.equal(record.containment_claims.claims.find((c) => c.claim.includes('secret')).holds, false);
  } finally {
    await app.close();
  }
});

test('a container refused by policy gets a record that shows it never started', async () => {
  const sandbox = new Sandbox({ buildArgs: (opts) => ['create', '--cap-add', 'SYS_ADMIN', ...new Sandbox().buildArgs(opts).slice(1)] });
  const r = await sandbox.run({ code: 'print("RAN")' });
  assert.equal(r.started, false);
  assert.equal(r.evidence.events.start, 'not observed');
  assert.match(r.evidence.events.create, /^\d{4}-/);
  assert.match(r.evidence.events.destroy, /^\d{4}-/);
  assert.equal(r.evidence.post_removal_inspect.failed_as_expected, true);
  assert.ok(r.evidence.inspect_before_start.HostConfig.CapAdd.length > 0);
  const claims = containmentClaims({ containers: [r], secretScan: { backend_secrets_found_in_outputs: 0 }, canary: { hits_during_run: 0 } });
  assert.equal(claims[0].holds, false);
});

test('claims are computed only from host-side values', () => {
  const info = { HostConfig: { NetworkMode: 'bridge' } };
  const claims = containmentClaims({
    containers: [{ walls: checkWalls(info, DEFAULT_LIMITS), attempts: [], evidence: { inspect_before_start: info } }],
    secretScan: { backend_secrets_found_in_outputs: 0 },
    canary: { hits_during_run: 'not measured' },
  });
  assert.equal(claims.find((c) => c.claim.includes('network mode')).holds, false);
  assert.equal(claims.find((c) => c.claim.includes('canary')).holds, 'not measured');
  assert.equal(claims.find((c) => c.claim.includes('canary')).strength.startsWith('weak'), true);
});

test('the scrubber touches scratch prefixes and the home directory, and leaves /tmp inside the container alone', () => {
  const scrub = makeScrubber({ secrets: ['s3cret'], workDir: '/tmp' });
  assert.equal(scrub('/tmp/pc-run-abc/input and {"/tmp":"rw"} and s3cret'), '<work-dir>/pc-run-abc/input and {"/tmp":"rw"} and [REDACTED]');
  const mac = makeScrubber({ workDir: '/var/folders/ab/cd/T' });
  assert.equal(mac('/host_mnt/private/var/folders/ab/cd/T/pc-run-x/code'), '<work-dir>/pc-run-x/code');
  assert.equal(makeScrubber()(`${homedir()}/x`), '<home>/x');
});

test('docker event lines parse, and nano timestamps keep full precision', () => {
  const out = parseEvents('{"Action":"die","Actor":{"Attributes":{"exitCode":"137"}},"time":1,"timeNano":1793000000123456789}\nnot json\n');
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'die');
  assert.equal(out[0].exit_code, '137');
  assert.equal(out[0].time_nano, '1793000000123456789');
  assert.equal(out[0].at, new Date(1793000000123).toISOString());
});
