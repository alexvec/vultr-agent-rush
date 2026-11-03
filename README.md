# Padded Cell

An AI agent analyses a file you do not trust by writing and running code. Every run produces a containment ledger: the limits applied, what the sandbox could see, what the code tried, how it ended, and proof the container is gone. The walls hold whatever the model decides to do.

Entry for the Vultr Agent Rush hackathon, Challenge 1, Blast Radius Zero. "Padded Cell" is a working title.

## Current status

| Item | Status |
|---|---|
| Sandbox walls | Tested with real Docker runs on a local machine (`npm test`) |
| Agent loop, ledger, API, UI | Tested locally. The "model" in those tests is a local stub |
| **Real Vultr Serverless Inference calls** | **Never made.** No key was available. The client has only been run against the local stub in `test/helpers/stub-inference.js` |
| **Deployment to a Vultr VM** | **Never run.** `deploy/deploy.sh` and `deploy/provision.sh` have been syntax-checked and linted only |
| Challenge 1 compliance | **Not met until both of the above happen** |

Things Vultr's docs leave open, or that only a real key can settle: the exact model id, the response schema, how tool results are handled, token usage reporting, rate limits. `npm run smoke:inference` is the first thing to run once a key exists.

## How it works

```
Browser ── HTTPS ──> Caddy ──> Node backend (host process, user paddedcell)
                                 │          │
                 chat completions│          │ docker create / inspect / start / rm
                                 v          v
              Vultr Serverless Inference   One container per run step
              kimi-k2-instruct             --network none, read-only root, empty env,
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
| Vultr Serverless Inference (`kimi-k2-instruct`, tool calling) | Every agent decision. `POST https://api.vultrinference.com/v1/chat/completions` with the subscription key. It is the only documented model with tool calling. | Code written, tested against a local stub only |
| Vultr Cloud Compute (VM) | Hosts the backend, the web app, Caddy and the Docker runtime that holds the sandbox | Runbook written, not run |

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

### What the ledger is, and is not

- `walls` comes from `docker inspect`. `probe` comes from a program in a same-flags container. Exit data comes from `docker inspect` and the backend's own timers. None of it can be changed by the code under test.
- `attempts` is reported from inside the sandbox, by a wrapper around Python's socket and file calls. **The code under test can forge or bypass it** (with ctypes, for example), and the ledger says so. It explains what happened. It is not the evidence that the walls held.
- Peak memory and CPU are not measured.

### Residual risks

- Plain Docker shares the host kernel. A kernel or runtime escape would reach the VM. gVisor would reduce this and is not implemented.
- The backend's user is in the `docker` group, which is equivalent to root on the VM. This is a deliberate trade: the backend stays out of a container, so no web-facing container holds the Docker socket. A backend compromise would still be serious.
- The model can be steered by a hostile file. The design assumes that it will be. Its text answer can therefore be wrong or misleading even with the walls intact.
- The sandbox cannot exfiltrate, but anything it prints goes to the model and the page. A hostile file can influence what the model says.
- `--network none` stops the sandbox from calling out. It does not limit what the backend sends to the inference API, and that includes file contents the model reads.
- Inference spend is capped per run and per hour, not eliminated. Rate limits are per process and in memory.

## Modes

| Mode | When | What is real |
|---|---|---|
| LLM | `VULTR_INFERENCE_API_KEY` is set | Everything, once it is run against Vultr |
| Scripted planner | No key | Sandbox, limits and ledger are real. The "agent" is a fixed script that ignores the question, and it runs the attack program on purpose when the file has injection text. Permanent banner, `/healthz` says `inference: absent`, every event and ledger is tagged `planner: scripted`. **This is not the product and must not be presented as LLM-driven.** |
| Direct attack | Either | Code goes straight to the sandbox with no model, tagged `planner: none` |
| Execution disabled | Vercel, or `PADDED_CELL_EXECUTION=disabled` | No sandbox object exists, so run endpoints return 503. The page says so |

If a key is present and rejected, the app shows an error and does not fall back to the script. `/healthz` says `inference: live` only after the API has answered this process, and `inference_detail` gives the reason otherwise.

## Run locally

Needs Node 20 or later and a running Docker daemon.

```sh
npm ci
npm run sandbox:build
npm start                 # http://127.0.0.1:8080, scripted mode without a key
```

With a key (never commit it, see `.env.example`):

```sh
cp .env.example .env      # then set VULTR_INFERENCE_API_KEY
node --env-file=.env scripts/smoke-inference.js    # real Vultr calls
node --env-file=.env src/server.js
```

## Tests

```sh
npm test            # real Docker for the walls; a local stub for the model
npx playwright install chromium
npm run demo        # browser walkthrough of docs/demo-path.md
```

To test the walls with the model out of the loop, read `test/sandbox-walls.test.js`. To record the walkthrough, see the comments at the top of `e2e/demo.spec.js`.

## Deploy to a Vultr VM

**This runbook has not been run against Vultr.** Expect to fix something the first time.

You need: an Ubuntu 24.04 Vultr Cloud Compute VM with your SSH key installed, and a Serverless Inference subscription key.

```sh
VULTR_INFERENCE_API_KEY=... deploy/deploy.sh root@<vm-ip>
```

Add `--domain your.domain` if you have one; otherwise it uses `<vm-ip>.sslip.io`, a third-party DNS service, so Caddy can get a TLS certificate. The script ships committed HEAD and passes the key over ssh stdin. On the VM it:

- Installs Docker, Caddy and Node
- Sets ufw to allow 22 (rate limited), 80 and 443; adds fail2ban and unattended upgrades; disables SSH password login if a key is present
- Sets kernel sysctls and Docker daemon defaults (`icc: false`, `no-new-privileges`)
- Creates the `paddedcell` user, builds the sandbox image, and stores the key in `/etc/padded-cell/env` with mode 0640
- Installs a hardened systemd unit with the backend bound to 127.0.0.1 behind Caddy
- Finishes with a `/healthz` check from your machine

Afterwards, confirm that `/healthz` reports `inference: live`, `host: vultr-vm`, and `sandbox.execution: enabled`.

## Preview host

`vercel.json` and `api/index.js` run the same application on Vercel. Vercel cannot run the Docker sandbox, so execution is turned off there and the page says so. A preview is not on Vultr and does not satisfy the track rule.

## Sample data

`samples/` is synthetic and generated for this repo. Vendor codes are placeholders. The poisoned file's target address uses the reserved `.invalid` domain.

## License

MIT. The app has no runtime npm dependencies. Playwright (Apache-2.0) is a development dependency. The sandbox image uses Alpine Linux and Python 3 at runtime.
