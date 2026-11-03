// No Docker needed: the listener itself, and what it reports.
import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';
import { CanaryListener } from '../src/canary.js';

const touch = (port) => new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.on('error', () => {}); // The listener resets the connection. That is its job.
  socket.on('close', resolve);
  socket.on('connect', () => socket.write('this payload is never read'));
});

test('the listener counts connections on loopback and says it is weak evidence', async () => {
  const canary = new CanaryListener();
  assert.equal(await canary.start(), true);
  try {
    assert.equal(canary.report(0).bound_to.startsWith('127.0.0.1:'), true, 'the default never binds a public address');
    await touch(canary.port);
    await touch(canary.port);
    const report = canary.report(1);
    assert.equal(report.hits_since_listener_start, 2);
    assert.equal(report.hits_during_run, 1);
    assert.equal(report.recent_hits[0].remote_address.endsWith('127.0.0.1'), true);
    assert.equal(report.evidence_strength, 'weak');
    assert.match(report.note, /Weak evidence.*does not prove/);
    assert.equal(JSON.stringify(report).includes('payload'), false);
  } finally {
    await canary.stop();
  }
});

test('a listener that cannot bind reports not measured instead of zero, and does not throw', async () => {
  const taken = new CanaryListener();
  await taken.start();
  const logged = [];
  const second = new CanaryListener({ port: taken.port, log: (event) => logged.push(event) });
  try {
    assert.equal(await second.start(), false);
    assert.equal(second.target(), null);
    assert.equal(second.report(0).listening, false);
    assert.equal(second.report(0).hits_during_run, 'not measured');
    assert.deepEqual(logged, ['canary_listener_failed']);
  } finally {
    await taken.stop();
  }
});
