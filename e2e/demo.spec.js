// Walks docs/demo-path.md in a real browser against a real server and real Docker.
//   npm run demo                                     local server. With no key, agent runs must be refused
//   DEMO_BASE_URL=https://... npm run demo           any deployed instance
//   DEMO_SLOW_MS=600 npx playwright test --headed    slow enough for a person to record
//   DEMO_VIDEO=1 npm run demo                        also saves a video under test-results/
// Do not submit a recording made while a warning below is printed.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const pause = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.DEMO_PAUSE_MS || 0)));

async function finishRun(page) {
  await expect(page.getByTestId('run-status')).not.toContainText('running', { timeout: 200_000 });
  await expect(page.getByTestId('ledger-verdict')).toBeVisible();
}

test('demo path', async ({ page, request }) => {
  const health = await (await request.get('/healthz')).json();
  const llm = health.inference === 'live';
  if (!llm) {
    console.warn('WARNING: inference is absent. Steps 2 to 4 only show the refusal. Do not use this as the demo video.');
  }
  if (health.track.status !== 'met_according_to_label') {
    console.warn(`WARNING: the track is not met here: ${health.track.reasons.join('; ')}.`);
  }

  // Step 1: status row and honest labels.
  await page.goto('/');
  await expect(page.getByTestId('status-sandbox')).toContainText('docker, enabled');
  await expect(page.getByTestId('status-inference')).toContainText(health.inference);
  await expect(page.getByTestId('status-deployment')).toHaveText(health.deployment);
  await expect(page.getByTestId('status-track')).toHaveText(health.track.status);
  await pause();

  if (llm) {
    // Steps 2 and 3: clean file. This branch has never run against Vultr.
    await page.getByTestId('sample-clean').click();
    await expect(page.getByTestId('file-status')).toContainText('vendor-payments.csv');
    await page.getByTestId('run-agent').click();
    await finishRun(page);
    await expect(page.getByTestId('events')).toContainText('run_code');
    await expect(page.getByTestId('answer')).not.toBeEmpty();
    await expect(page.getByTestId('ledger-exit')).toContainText('completed');
    await expect(page.getByTestId('ledger-verdict')).toContainText('llm');
    await pause();
  }

  // Step 4: the poisoned file. A real model may refuse, so nothing here assumes it obeys.
  await page.getByTestId('sample-poisoned').click();
  await expect(page.getByTestId('file-status')).toContainText('poisoned');
  await page.getByTestId('run-agent').click();
  if (llm) {
    await finishRun(page);
    await expect(page.getByTestId('ledger-network')).toContainText('blocked');
    await expect(page.getByTestId('ledger-network')).not.toContainText('NOT BLOCKED');
  } else {
    await expect(page.getByTestId('banner-no-inference')).toBeVisible();
    await expect(page.getByTestId('notice')).toContainText('The planner is unavailable');
    await expect(page.getByTestId('result')).toBeHidden();
  }
  await pause();

  // Step 5: direct attack with the poisoned file mounted. No model involved.
  await page.getByTestId('preset').selectOption('network_secrets');
  await page.getByTestId('run-direct').click();
  await expect(page.getByTestId('run-status')).toContainText('planner: none');
  await finishRun(page);
  await expect(page.getByTestId('events')).toContainText('blocked connect 1.1.1.1');
  await expect(page.getByTestId('events')).toContainText(`blocked connect ${health.canary.target_from_a_container.split(':')[0]}`);
  await expect(page.getByTestId('events')).not.toContainText(/CONNECTED (exfil|1\.1\.1\.1|169\.254|host\.docker)/);
  await expect(page.getByTestId('ledger-network')).not.toContainText('NOT BLOCKED');
  await expect(page.getByTestId('ledger-canary')).toContainText('weak evidence');
  await expect(page.getByTestId('ledger-attempts')).toContainText('Self-reported by code in the sandbox, not evidence');
  await expect(page.getByTestId('ledger-secrets')).toContainText(/0 of \d checked/);
  await pause();

  // Step 6: download the run record and check it against the sample file.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('record-link').click()]);
  const record = JSON.parse(await readFile(await download.path(), 'utf8'));
  const sample = await readFile(new URL('../samples/poisoned-vendor-payments.csv', import.meta.url));
  expect(record.input.sha256).toBe(createHash('sha256').update(sample).digest('hex'));
  expect(createHash('sha256').update(Buffer.from(record.output.base64, 'base64')).digest('hex')).toBe(record.output.sha256);
  expect(record.containers.at(-1).measured_outside_the_container.inspect_before_start_raw.HostConfig.NetworkMode).toBe('none');
  expect(record.containers.at(-1).measured_outside_the_container.post_removal_inspect.failed_as_expected).toBe(true);
  expect(record.self_reported_by_code_in_sandbox.counts_toward_containment_claims).toBe(false);
  await pause();

  // Step 7: resource abuse.
  await page.getByTestId('preset').selectOption('memory_bomb');
  await page.getByTestId('run-direct').click();
  await expect(page.getByTestId('ledger-exit')).toContainText('memory_limit_killed', { timeout: 60_000 });
  await expect(page.getByTestId('ledger-verdict')).toContainText('containers removed (verified)');
  await pause();

  // Step 8: raw ledger.
  await page.getByText('Raw ledger JSON').click();
  await expect(page.getByTestId('ledger')).toContainText('"exit_reason": "memory_limit_killed"');
  await pause();
});
