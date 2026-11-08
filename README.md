# Padded Cell

An AI agent analyses a file you do not trust by writing and running code. Every run produces a containment ledger and a downloadable run record: the limits applied, what the sandbox could see, how it ended, and the host-side evidence that the container is gone. The walls hold whatever the model decides to do.

Entry for the Vultr Agent Rush hackathon, Challenge 1, Blast Radius Zero. "Padded Cell" is a working title.

## Current status

| Item | Status |
|---|---|
| Sandbox walls | Exercised with real Docker on the Vultr VM and, in the test suite, on a local Mac |
| Agent loop, ledger, record, API, UI | Live on the VM. Local tests still use the stub in `test/helpers/stub-inference.js` |
| **Real Vultr Serverless Inference calls** | **Made.** Model `deepseek-v4.1-flash-1017`. `kimi-k2-instruct` is not in the current model list |
| **Deployment to a Vultr VM** | **https://65.20.88.246.sslip.io** (Mumbai, `65.20.88.246`, AS20473). `/healthz` reports commit `22aef18` |
| Challenge 1 compliance | `/healthz` reports `track.status: met_according_to_label` after a chat completion in that process. It returns to `not_met` after a restart until the next agent run |

**Last measured local results** (commit `38b5008`, Mac, Docker Desktop engine 29.1.3, no inference key):

- `npm test`: 62 tests, 62 passed, 0 failed, 0 skipped. Real Docker for the walls. A local stub stands in for the model, so this says nothing about the real API.
- `npm run demo`: 1 Playwright walkthrough, passed. With no key, the agent steps 2 and 3 are skipped and step 4 only checks the refusal. Direct mode, the record download and the memory bomb ran for real.
- One hostile direct-mode run through the HTTP API: `docs/evidence/local-direct-run.json`, explained in `docs/evidence/README.md`.

An earlier version of this file quoted 39 of 40. That was a run from before the suite was finished and is no longer current. The first commit already had 41 `test(` calls, and adding `test/wall-policy.test.js` brought it to 47. Run on the code before this rebuild, those 47 calls were 47 tests and all passed. The suite now has 62.

A live agent run on 8 November 2026 used `samples/poisoned-vendor-payments.csv`. The model did not follow the injected instruction. It summed the paid rows and answered `21690.12`. The downloaded record's `input.sha256` matches the file, `output.sha256` matches the decoded output, both containers had network mode `none`, and `docker inspect` after removal failed with "No such container". The short record is `docs/evidence/live-poisoned-2026-11-08.json`. `inference_verified_by` resets to `models_list_only` when the process restarts, until the next chat completion.

## How it works

```
Browser ── HTTPS ──> Caddy ──> Node backend (host process, user paddedcell)
                                 │          │
                 chat completions│          │ docker create / inspect / start / rm
                                 v          v
              Vultr Serverless Inference   One container per run step
              deepseek-v4.1-flash-1017     --network none, read-only root, empty env,
              tool calling                 no capabilities, memory/CPU/pids limits
```

1. The upload is held by the backend. It only reaches the sandbox as a read-only file at `/input/data`. The uploaded filename is never used on disk.
2. A probe program runs in a container with the same flags and reports what it can really see and do. If a wall fails, the agent does not start.
3. Each step is a chat completion with two tools, `read_input_file` and `run_code`. The model decides. The backend executes `run_code` in a new container and returns the result.
4. Before each container starts, the backend reads `docker inspect` and compares it with the wall policy. A mismatch means the container is removed without being started.
5. After each run the container is force-removed, and a second inspect confirms it no longer exists. A reaper handles anything a crash leaves behind.

There is no code path that executes anything outside `src/sandbox.js`, and no fallback if Docker is missing: execution reports as unavailable and requests get a 503.

## Vultr services

| Service | What it does here | State |
|---|---|---|
| Vultr Serverless Inference (`deepseek-v4.1-flash-1017`, tool calling) | Every agent decision. `POST https://api.vultrinference.com/v1/chat/completions` with the subscription key. Vultr's older docs name `kimi-k2-instruct` for tool calling; that id is not in the current list, and this model completed tool calls. | Live on the VM |
| Vultr Cloud Compute (VM) | Hosts the backend, the web app, Caddy and the Docker runtime that holds the sandbox | Running at https://65.20.88.246.sslip.io |

## The walls

| Focus | Control | How it is checked |
|---|---|---|
| Network | `--network none` | Hostile code tries DNS, a public IP and the metadata address. A control test connects to a host listener from a bridge container with the same client, to show the assertion can fail |
| Process isolation | Non-root uid 65534, all capabilities dropped, no-new-privileges, default seccomp kept, private IPC, no setuid binaries in the image | Probe reads `/proc/self/status`; policy check reads `docker inspect` |
| Filesystem | Read-only root, read-only input and code mounts, size-limited `noexec` tmpfs on `/tmp` | Hostile writes and an exec attempt in the tests |
| Secrets | Key only in the backend's environment. The docker CLI gets a minimal env. The container starts through `env -i`. Logs and errors redact the key | Tests read `os.environ`, `/proc/self/environ` and `/proc/1/environ` with a canary key set in the backend |
| Resources | 128 MiB memory with no swap, 0.5 CPU, 32 pids, 10 s wall clock, 64 KiB output, 16 MiB scratch. Per run: 8 steps, 20,000 tokens, 180 s | Memory bomb, infinite loop, fork bomb, output flood and disk fill in the tests |
| Lifecycle | One container per step, force-removed, removal verified, stale reaper | Tests assert removal and that no labelled container survives the test run |
| Public endpoints | Per-IP rate limits, 2 concurrent runs, 30 model-driven runs per hour, 200 KB file cap, 300 KB body cap, strict CSP, all results rendered as text | Tests |

### Exact `docker create` flags

Copied from `src/sandbox.js`, with the default limits filled in. Use this to run the same hostile code against the same walls. `<name>`, `<input-dir>` and `<code-dir>` are yours; the program's own labels are left out.

```
docker create --name <name> --pull never --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16777216 \
  --memory 134217728 --memory-swap 134217728 --cpus 0.5 --pids-limit 32 \
  --ulimit nofile=128:128 --ulimit core=0:0 --cap-drop ALL \
  --security-opt no-new-privileges --user 65534:65534 --ipc none \
  --hostname cell --workdir /tmp --log-driver none --restart no --oom-score-adj 1000 \
  -v <input-dir>:/input:ro -v <code-dir>:/code:ro \
  padded-cell-sandbox:latest /usr/bin/env -i <command>
```

### What the ledger is, and is not

- `walls` comes from `docker inspect`. Exit data comes from `docker inspect` and the backend's own timers. `probe` comes from our program in a separate same-flags container, before any untrusted code runs. The code under test cannot change any of these.
- `attempts` is reported from inside the sandbox, by a wrapper around Python's socket and file calls. **The code under test can forge or bypass it** (with ctypes, for example). It is labelled self-reported in the page and the record, and no containment claim depends on it. A test forges a successful connection and checks that no claim changes.
- Peak memory and CPU are not measured.

### The run record

`GET /api/runs/<id>/record` downloads a JSON file, also linked on the page once a run ends. Runs are held in memory for 30 minutes.

| Field | What it holds | Where the value comes from |
|---|---|---|
| `input.sha256`, `output.sha256`, `output.base64` | Hash of the uploaded bytes, and hash and exact bytes of the last run's stdout | Hashed by the backend. The stdout content is written by the code under test |
| `model_code` | The code the model wrote, when a model ran | Tool call |
| `inference.calls[]` | Response id, model, usage and any request-id header, per call. A missing field says `not returned` | API response |
| `containers[].measured_outside_the_container` | Raw `docker inspect` before start, final `State`, create, start, die and destroy timestamps, and the failed inspect after removal | Docker CLI, run by the backend |
| `canary` | Hit count from the host-side listener | Backend. Weak evidence |
| `self_reported_by_code_in_sandbox` | The `attempts` list | Inside the sandbox. Feeds no claim |

To check a record:

```sh
sha256sum samples/poisoned-vendor-payments.csv   # compare with input.sha256
jq -r .output.base64 record.json | base64 -d | sha256sum   # compare with output.sha256
```

The record is not signed. The hashes let you compare it with files you hold. They do not prove the server told the truth, and the host-side values come from docker commands the same backend ran. Backend secrets, the scratch directory prefix and the home directory are replaced in the file, and if an output contains one of them its `base64` is withheld.

### The canary

The backend runs a TCP listener outside every container. It counts connections and reads nothing from them. It adds no sandbox flag and no route: containers still have `--network none`. By default it binds to loopback on a random port. `deploy/provision.sh` binds it to the Docker bridge address, so it is not reachable from the internet.

**This is weak evidence.** Zero hits means nothing connected to this one address, not that nothing left the sandbox. The count covers the whole listener, so a hit may come from another run or process. The poisoned sample names a reserved `.invalid` address, not the listener, so a steered model has no reason to hit it. The "Steal credentials" preset does aim at it. A control test shows a bridge container does register a hit.

### Residual risks

- Plain Docker shares the host kernel. A kernel or runtime escape would reach the VM. gVisor would reduce this and is not implemented.
- The backend's user is in the `docker` group, which is equivalent to root on the VM. This is a deliberate trade: the backend stays out of a container, so no web-facing container holds the Docker socket. A backend compromise would still be serious.
- The model can be steered by a hostile file. The design assumes that it will be. Its text answer can therefore be wrong or misleading even with the walls intact.
- The sandbox cannot exfiltrate, but anything it prints goes to the model and the page. A hostile file can influence what the model says.
- `--network none` stops the sandbox from calling out. It does not limit what the backend sends to the inference API, and that includes file contents the model reads.
- Inference spend is capped per run and per hour, not eliminated. Rate limits are per process and in memory.

## Modes

| Mode | When | What happens |
|---|---|---|
| Agent | `VULTR_INFERENCE_API_KEY` is set | Every step is a chat completion. Never run against Vultr so far |
| Agent, no key | The key is not set | Refused with a 503 and `inference_not_configured`. Nothing runs and nothing is substituted |
| Direct | Any time the sandbox is available | Code goes straight to the sandbox with no model, tagged `planner: none` |
| Execution disabled | Vercel, or `PADDED_CELL_EXECUTION=disabled` | No sandbox object exists, so run endpoints return 503. The page says so |

If a key is present and rejected, or a model call fails during a run, the run ends in an error with nothing substituted. A fixed-script planner exists only as a test fixture, in `test/helpers/scripted-planner.js`. The app cannot import it.

`/healthz` reports:

- `inference`: `live` only after the API has answered this process. `inference_verified_by` says whether that was only `/models` or a real chat completion.
- `deployment` and `host`: labels from `PADDED_CELL_DEPLOYMENT` and `PADDED_CELL_HOST`, written by `deploy/deploy.sh`. The app does not verify them, and `deployment_basis` says so. To check, look up the network owner of the hostname.
- `track.status`: `not_met`, with reasons, unless the label says `vultr-vm`, inference is live at the Vultr base URL, a chat completion has succeeded in this process and the sandbox is enabled. Then it says `met_according_to_label`, because the deployment half is still a label. After a restart it returns to `not_met` until the next agent run.

## Run locally

Needs Node 20 or later and a running Docker daemon.

```sh
npm ci
npm run sandbox:build
npm start                 # http://127.0.0.1:8080. Without a key, only direct mode runs
```

With a key (never commit it, see `.env.example`):

```sh
cp .env.example .env      # then set VULTR_INFERENCE_API_KEY
node --env-file=.env scripts/smoke-inference.js    # real Vultr calls
node --env-file=.env src/serve.js
```

## Tests

```sh
npm test            # real Docker for the walls; a local stub for the model
npx playwright install chromium
npm run demo        # browser walkthrough of docs/demo-path.md. Without a key it checks the refusal in place of the agent steps
```

To test the walls with the model out of the loop, read `test/sandbox-walls.test.js`. To record the walkthrough, see the comments at the top of `e2e/demo.spec.js`.

## Deploy to a Vultr VM

**This runbook has never been run, on Vultr or anywhere else.** Expect to fix something the first time.

You need: an Ubuntu 24.04 Vultr Cloud Compute VM with your SSH key installed, and a Serverless Inference subscription key.

```sh
VULTR_INFERENCE_API_KEY=... deploy/deploy.sh root@<vm-ip>
```

Add `--domain your.domain` if you have one; otherwise it uses `<vm-ip>.sslip.io`, a third-party DNS service, so Caddy can get a TLS certificate. The script ships committed HEAD and passes the key over ssh stdin. On the VM it:

- Installs Docker, Caddy and Node
- Sets ufw to allow 22 (rate limited), 80 and 443; adds fail2ban and unattended upgrades; disables SSH password login if a key is present
- Sets kernel sysctls and Docker daemon defaults (`icc: false`, `no-new-privileges`)
- Creates the `paddedcell` user, builds the sandbox image, and stores the key and the deployment labels in `/etc/padded-cell/env` with mode 0640
- Binds the canary to the Docker bridge address, with a ufw rule for that interface and port only
- Installs a hardened systemd unit with the backend bound to 127.0.0.1 behind Caddy
- Finishes with a `/healthz` check from your machine

Afterwards, run one agent run and confirm that `/healthz` reports `inference_verified_by: chat_completion`, `deployment: vultr-vm`, `track.status: met_according_to_label` and `sandbox.execution: enabled`. The script labels whatever host you point it at, so point it only at a Vultr VM.

## Preview host

https://padded-cell-preview.vercel.app runs the same application through `vercel.json` and `api/index.js`. Vercel cannot run the Docker sandbox, so execution is turned off there: no agent or attack can run, and the page says so. It has no inference key. It is not on Vultr, does not satisfy the track rule, and is not the demo URL.

## Sample data

`samples/` is synthetic and generated for this repo. Vendor codes are placeholders. The poisoned file's target address uses the reserved `.invalid` domain.

## License

MIT. The app has no runtime npm dependencies. Playwright (Apache-2.0) is a development dependency. The sandbox image uses Alpine Linux and Python 3 at runtime.
