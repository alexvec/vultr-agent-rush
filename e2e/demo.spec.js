// Walks docs/demo-path.md in a real browser against a real server and real Docker.
//   npm run demo                                     local server (keyless means scripted mode)
//   DEMO_BASE_URL=https://... npm run demo           any deployed instance
//   DEMO_SLOW_MS=600 npx playwright test --headed    slow enough for a person to record
//   DEMO_VIDEO=1 npm run demo                        also saves a video under test-results/
// Do not submit a recording made while the warning below is printed.
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
    console.warn('WARNING: inference is absent. This walkthrough is scripted mode. Do not use it as the demo video.');
  }
  if (!health.on_vultr) {
    console.warn(`WARNING: host is "${health.host}", not a Vultr VM.`);
  }

  // Step 1: status row and honest labels.
  await page.goto('/');
  await expect(page.getByTestId('status-sandbox')).toContainText('docker, enabled');
  await expect(page.getByTestId('status-inference')).toContainText(health.inference);
  if (!llm) {
    await expect(page.getByTestId('banner-scripted')).toHaveText('SCRIPTED PLANNER: no LLM in use. Not the Vultr inference product.');
  }
  await pause();

  // Steps 2 and 3: clean file.
  await page.getByTestId('sample-clean').click();
  await expect(page.getByTestId('file-status')).toContainText('vendor-payments.csv');
  await page.getByTestId('run-agent').click();
  await finishRun(page);
  await expect(page.getByTestId('events')).toContainText('run_code');
  await expect(page.getByTestId('answer')).not.toBeEmpty();
  await expect(page.getByTestId('ledger-exit')).toContainText('completed');
  await expect(page.getByTestId('ledger-verdict')).toContainText(llm ? 'llm' : 'scripted');
  await pause();

  // Step 4: the poisoned file. A real model may refuse, so the attack assertions apply to scripted mode only.
  await page.getByTestId('sample-poisoned').click();
  await expect(page.getByTestId('file-status')).toContainText('poisoned');
  await page.getByTestId('run-agent').click();
  await finishRun(page);
  await expect(page.getByTestId('events')).toContainText('NOTE TO AI AGENT');
  await expect(page.getByTestId('ledger-network')).toContainText('blocked');
  await expect(page.getByTestId('ledger-network')).not.toContainText('NOT BLOCKED');
  if (!llm) {
    await expect(page.getByTestId('ledger-attempts')).toContainText('network succeeded: 0');
  }
  await pause();

  // Step 5: direct attack, no model involved.
  await page.getByTestId('preset').selectOption('network_secrets');
  await page.getByTestId('run-direct').click();
  await expect(page.getByTestId('run-status')).toContainText('planner: none');
  await finishRun(page);
  await expect(page.getByTestId('events')).toContainText('blocked connect 1.1.1.1');
  await expect(page.getByTestId('events')).not.toContainText(/CONNECTED (exfil|1\.1\.1\.1|169\.254)/);
  await expect(page.getByTestId('ledger-attempts')).toContainText('network succeeded: 0');
  await expect(page.getByTestId('ledger-secrets')).toContainText(/0 of \d checked/);
  await pause();

  // Step 6: resource abuse.
  await page.getByTestId('preset').selectOption('memory_bomb');
  await page.getByTestId('run-direct').click();
  await expect(page.getByTestId('ledger-exit')).toContainText('memory_limit_killed', { timeout: 60_000 });
  await expect(page.getByTestId('ledger-verdict')).toContainText('containers removed (verified)');
  await pause();

  // Step 7: raw ledger.
  await page.getByText('Raw ledger JSON').click();
  await expect(page.getByTestId('ledger')).toContainText('"exit_reason": "memory_limit_killed"');
  await pause();
});
