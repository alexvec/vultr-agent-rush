// All run data, including file contents and model output, is hostile.
// It only ever reaches the page through textContent, never as HTML.
const $ = (id) => document.getElementById(id);
let file = null;
let polling = null;
let presets = [];
let executionEnabled = false;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else node.textContent = value;
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

function notice(text) {
  const box = $('notice');
  box.textContent = text ?? '';
  box.hidden = !text;
}

function setRunning(running) {
  $('run-agent').disabled = running || !executionEnabled;
  $('run-direct').disabled = running || !executionEnabled;
}

async function refreshHealth() {
  const res = await fetch('/healthz');
  const h = await res.json();
  $('st-inference').textContent = `${h.inference} (${h.inference_detail})`;
  $('st-model').textContent = h.model ?? 'none';
  $('st-planner').textContent = h.planner;
  $('st-sandbox').textContent = `${h.sandbox.runtime}, ${h.sandbox.execution}`;
  $('st-deployment').textContent = h.deployment;
  $('st-host').textContent = h.host;
  $('st-track').textContent = h.track.status;
  $('st-track').title = [...h.track.reasons, h.track.note].join(' ');
  $('st-canary').textContent = h.canary.listening ? String(h.canary.hits_since_listener_start) : 'not measured';
  executionEnabled = h.sandbox.execution === 'enabled';
  setRunning(Boolean(polling));
  if (!executionEnabled && h.sandbox.reason) notice(h.sandbox.reason);
}

async function loadPresets() {
  const res = await fetch('/api/presets');
  presets = (await res.json()).presets;
  for (const preset of presets) {
    const option = el('option', { text: preset.title });
    option.value = preset.id;
    $('preset').append(option);
  }
  choosePreset();
}

function choosePreset() {
  const preset = presets.find((p) => p.id === $('preset').value);
  if (!preset) return;
  $('code').value = preset.code;
  $('preset-description').textContent = preset.description;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function useSample(name) {
  const res = await fetch(`/samples/${name}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  file = { name, base64: bytesToBase64(bytes), size: bytes.length };
  $('file-status').textContent = `${name}, ${bytes.length} bytes.`;
}

async function chooseFile(event) {
  const chosen = event.target.files[0];
  if (!chosen) return;
  if (chosen.size > 200 * 1024) {
    file = null;
    $('file-status').textContent = 'That file is over the 200 KB limit.';
    return;
  }
  const bytes = new Uint8Array(await chosen.arrayBuffer());
  file = { name: chosen.name, base64: bytesToBase64(bytes), size: bytes.length };
  $('file-status').textContent = `${chosen.name}, ${bytes.length} bytes.`;
}

function clearResult() {
  $('result').hidden = false;
  $('run-id').textContent = '';
  $('run-status').textContent = 'running';
  $('ledger').replaceChildren();
  $('record-link').hidden = true;
  $('events').replaceChildren();
  $('answer').textContent = '';
  $('answer-box').hidden = true;
  $('ledger-wait').hidden = false;
}

async function start(path, body) {
  notice(null);
  setRunning(true);
  clearResult();
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    notice(data.message ?? `Request failed with status ${res.status}.`);
    $('result').hidden = true;
    setRunning(false);
    return;
  }
  poll(data.id);
}

function poll(id) {
  clearTimeout(polling);
  const tick = async () => {
    const res = await fetch(`/api/runs/${id}`);
    if (!res.ok) {
      polling = null;
      notice('Lost track of the run.');
      setRunning(false);
      return;
    }
    const run = await res.json();
    render(run);
    if (run.status === 'running') {
      polling = setTimeout(tick, 700);
    } else {
      polling = null;
      setRunning(false);
    }
  };
  polling = setTimeout(tick, 300);
}

function render(run) {
  $('run-id').textContent = run.id;
  $('run-status').textContent = `${run.status}, planner: ${run.planner}`;
  $('events').replaceChildren(...run.events.map(renderEvent));
  if (run.answer) {
    $('answer-box').hidden = false;
    $('answer').textContent = run.answer;
  }
  if (run.error) notice(`${run.error.code}: ${run.error.message}`);
  if (run.status !== 'running') {
    $('record-link').href = `/api/runs/${run.id}/record`;
    $('record-link').hidden = false;
  }
  if (run.ledger) {
    $('ledger-wait').hidden = true;
    $('ledger').replaceChildren(renderLedger(run.ledger));
  }
}

function renderEvent(event) {
  const item = el('li', {}, el('span', { class: 'kind', text: event.type }), el('span', { class: 'tag', text: `planner: ${event.planner}` }));
  if (event.type === 'planner_request') {
    item.append(el('div', { text: `Chat completion request to ${event.model}, step ${event.step}.` }));
  } else if (event.type === 'tool_call') {
    const args = event.arguments;
    item.append(el('div', { text: `Tool: ${event.tool}` }));
    item.append(el('pre', { text: typeof args?.code === 'string' ? args.code : JSON.stringify(args) }));
  } else if (event.type === 'tool_result') {
    item.append(el('pre', { text: formatToolResult(event.content) }));
  } else if (event.type === 'probe_result') {
    item.append(el('div', { text: event.failures.length ? `Wall failures: ${event.failures.join('; ')}` : `Probe passed. Container ${event.container}, removal verified: ${event.removed_verified}.` }));
  } else if (event.type === 'error') {
    item.append(el('div', { class: 'fail', text: event.message }));
  } else if (event.type === 'final_answer') {
    item.append(el('div', { text: 'Agent finished.' }));
  }
  return item;
}

function formatToolResult(content) {
  try {
    const r = JSON.parse(content);
    if (r && r.exit_reason) {
      return `exit_reason: ${r.exit_reason}, exit_code: ${r.exit_code}\n--- stdout ---\n${r.stdout}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`;
    }
  } catch { /* not JSON: show it as it came */ }
  return content;
}

function table(rows) {
  return el('table', {}, ...rows.map(([key, value, cls]) => el('tr', {}, el('td', { text: key }), el('td', { text: String(value), class: cls ?? '' }))));
}

function card(title, source, body, testid) {
  const node = el('div', { class: 'card' }, el('h4', { text: title }), source ? el('p', { class: 'source', text: source }) : null, body);
  if (testid) node.dataset.testid = testid;
  return node;
}

const blocked = (attempt) => (attempt?.ok === false ? 'blocked' : 'NOT BLOCKED');
const blockedClass = (attempt) => (attempt?.ok === false ? 'ok' : 'fail');

function renderLedger(ledger) {
  const probe = ledger.probe.observed ?? {};
  const grid = el('div', { class: 'grid' });
  const lastExecution = ledger.executions.at(-1);
  const failed = ledger.walls.containers_failed + ledger.probe.failures.length;

  grid.append(card('Verdict', `planner: ${ledger.planner}${ledger.model ? `, model: ${ledger.model}` : ''}, deployment label: ${ledger.deployment}, host: ${ledger.host}`, table([
    ['ended by', ledger.ended_by],
    ['wall checks failed', failed, failed ? 'fail' : 'ok'],
    ['containers created', ledger.lifecycle.containers_created],
    ['containers removed (verified)', ledger.lifecycle.containers_removed_verified, ledger.lifecycle.containers_removed_verified === ledger.lifecycle.containers_created ? 'ok' : 'fail'],
    ['duration ms', ledger.duration_ms],
    ['model requests', ledger.agent.model_requests],
    ['tokens reported by the API', ledger.agent.tokens?.total_tokens ?? 'n/a'],
  ]), 'ledger-verdict'));

  grid.append(card('Network', ledger.probe.source, table([
    ['interfaces up', (probe.interfaces_up ?? []).join(', ') || 'none'],
    ['routes', probe.route_count],
    ['public IP 1.1.1.1:443', blocked(probe.tcp_public_ip), blockedClass(probe.tcp_public_ip)],
    ['metadata 169.254.169.254', blocked(probe.tcp_metadata_ip), blockedClass(probe.tcp_metadata_ip)],
    ['DNS', blocked(probe.dns_lookup), blockedClass(probe.dns_lookup)],
  ]), 'ledger-network'));

  grid.append(card('Secrets and filesystem', ledger.probe.source, table([
    ['env vars visible', (ledger.secrets.env_names_seen_in_sandbox ?? []).length, (ledger.secrets.env_names_seen_in_sandbox ?? []).length ? 'fail' : 'ok'],
    ['backend secrets found in outputs', `${ledger.secrets.backend_secrets_found_in_outputs} of ${ledger.secrets.backend_secrets_checked} checked`, ledger.secrets.backend_secrets_found_in_outputs ? 'fail' : 'ok'],
    ['docker socket visible', probe.docker_socket_present, probe.docker_socket_present === false ? 'ok' : 'fail'],
    ['write to /', blocked(probe.write_root), blockedClass(probe.write_root)],
    ['write to /input', blocked(probe.write_input), blockedClass(probe.write_input)],
    ['effective capabilities', probe.status?.CapEff],
  ]), 'ledger-secrets'));

  if (lastExecution) {
    grid.append(card('How the code ended', 'docker inspect and the backend timers, on the host side', table([
      ['exit reason', lastExecution.exit_reason],
      ['exit code', lastExecution.exit_code],
      ['OOM killed', lastExecution.oom_killed],
      ['wall clock killed', lastExecution.timed_out],
      ['output cap hit', lastExecution.output_truncated],
      ['container removed (verified)', lastExecution.removed_verified, lastExecution.removed_verified ? 'ok' : 'fail'],
    ]), 'ledger-exit'));
  }

  const canary = ledger.canary ?? {};
  const canaryHits = canary.hits_during_run;
  grid.append(card('Canary listener: weak evidence', canary.note ?? canary.evidence_strength, table([
    ['read from', canary.read_from ?? 'not measured'],
    ['target from a container', canary.target_from_a_container ?? 'none'],
    ['hits during this run', canaryHits, canaryHits === 0 ? 'ok' : (typeof canaryHits === 'number' ? 'fail' : '')],
  ]), 'ledger-canary'));

  const attempts = ledger.attempts;
  const attemptRows = attempts.records.slice(0, 30).map((a) => [a.kind, `${a.target} -> ${a.outcome}`, a.outcome === 'succeeded' && a.kind.startsWith('network') ? 'fail' : '']);
  grid.append(card(`Self-reported by code in the sandbox, not evidence: ${attempts.total} attempts (network: ${attempts.network}, network succeeded: ${attempts.network_succeeded})`, `${attempts.source}. No containment claim depends on this.`, table(attemptRows), 'ledger-attempts'));

  const limits = ledger.limits_applied ?? {};
  grid.append(card('Limits applied', 'configured on the container, confirmed by docker inspect below', table([
    ['memory bytes', limits.memoryBytes],
    ['nano CPUs', limits.nanoCpus],
    ['pids', limits.pidsLimit],
    ['wall clock ms', limits.wallClockMs],
    ['output bytes', limits.outputBytes],
    ['scratch tmpfs bytes', limits.tmpfsBytes],
  ])));

  const walls = el('details', {}, el('summary', { text: `Wall checks from docker inspect: ${ledger.walls.containers_checked} containers checked, ${ledger.walls.containers_failed} failed` }),
    table(ledger.walls.checks.map((w) => [w.wall, `${JSON.stringify(w.actual)}${w.ok ? '' : ` (expected ${JSON.stringify(w.expected)})`}`, w.ok ? 'ok' : 'fail'])));
  const raw = el('details', {}, el('summary', { text: 'Raw ledger JSON' }), el('pre', { text: JSON.stringify(ledger, null, 2) }));
  return el('div', {}, grid, walls, raw);
}

$('sample-clean').addEventListener('click', () => useSample('vendor-payments.csv'));
$('sample-poisoned').addEventListener('click', () => useSample('poisoned-vendor-payments.csv'));
$('file').addEventListener('change', chooseFile);
$('preset').addEventListener('change', choosePreset);
$('agent-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!file) { notice('Choose a file or a sample first.'); return; }
  start('/api/runs/agent', { question: $('question').value, filename: file.name, content_base64: file.base64 });
});
$('direct-form').addEventListener('submit', (event) => {
  event.preventDefault();
  start('/api/runs/direct', { code: $('code').value, preset: null, filename: file?.name ?? null, content_base64: file?.base64 ?? null });
});

setRunning(false);
loadPresets();
refreshHealth();
setInterval(() => { refreshHealth().catch(() => {}); }, 30_000);
