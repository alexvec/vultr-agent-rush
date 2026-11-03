# PRD: Challenge 1, Blast Radius Zero (CHOSEN)

Working title: Padded Cell (placeholder). Rules: docs/competition.md s3 and s12.

## User

An operations or finance analyst, or a small-team engineer, who receives files they do not control (a vendor export, a third-party log, a CSV from a partner) and wants an AI agent to analyse them by writing and running code, but cannot let that agent touch the company network, credentials or other files. No named person or customer is claimed; this is a described persona, not evidence of demand.

## Job to be done

"Analyse this untrusted file by running code, and prove nothing escaped."

## Product concept

The user uploads a file and asks a question. A Vultr-hosted agent, driven by kimi-k2-instruct on Vultr Serverless Inference through tool calling, writes code and runs it in a locked-down Docker sandbox on a Vultr VM. The user gets the answer plus a containment ledger for the run: the limits applied, what the sandbox could see (no secrets, no network), what the agent attempted that the walls blocked, how the run ended, and confirmation the container was destroyed. The file may contain hostile instructions (prompt injection); the demo shows the agent being steered and the sandbox, not the model's good behaviour, holding the line.

## Partner capability that does the work

- **Vultr Serverless Inference, kimi-k2-instruct, tool calling.** Each agent step is a chat completion with `tools` defined; the model chooses `run_code` or `read_input_file`; the backend executes and returns tool results. Documented as supported only on kimi-k2-instruct (rule book s12). Remove the inference and there is no agent.
- **Vultr Cloud Compute.** Hosts the backend, web app and Docker runtime. Both are required by the track.
- Sandbox: Docker (strongly recommended by the track). gVisor `runsc` is a stretch goal only.

## Containment design (the focus areas named by the track)

| Focus | Control |
|---|---|
| Process isolation | Container per run; non-root user; no privileged; all capabilities dropped; no-new-privileges; default seccomp kept; read-only root filesystem; tmpfs scratch; input mounted read-only |
| Network | `--network none` |
| Secret hygiene | Inference key lives only in the backend process env, never in the container or in prompts; sandbox env is empty; ledger asserts what env the sandbox saw; logs redact the key |
| Resource limits | Memory, CPU, pids limits; wall-clock kill; output size cap; per-run step and token cap |
| Lifecycle | Container created, run, force-removed; ledger verifies absence; stale-container reaper on a timer |

Residual risks (stated in README, not hidden): shared host kernel with plain Docker; the backend must be a host process under a dedicated user rather than a container with the Docker socket mounted; a model-driven denial of wallet via inference tokens (capped).

## Demo must show, on real input

1. Open the live URL on Vultr. `/healthz` shows `inference: live` and the model id.
2. Upload a real file (a CSV or log file produced for the demo, committed to the repo as the sample so reviewers can reproduce).
3. Ask a normal question; the agent calls Vultr inference, writes code, the sandbox runs it, the answer returns with correct values that can be checked by hand.
4. **Containment moment (mandatory for the video):** upload a second file whose content contains an injected instruction to read credentials and contact an external URL. Show the agent attempting it (tool call visible), and the ledger showing: network unreachable, no secrets present, nothing exfiltrated.
5. Resource-abuse moment: a run that exceeds memory or time and is killed by the limit; ledger shows the exit reason and that the container is gone.
6. Every number on screen comes from the live run. No pre-recorded or hand-typed ledger.

If the model refuses the injection on its own, say so honestly and show a direct attack run (code the user supplies) so the sandbox is still tested. Do not claim the model was fooled if it was not.

## Behaviour when the inference key is absent

- Backend starts, detects no `VULTR_INFERENCE_API_KEY`, and enters **scripted-planner mode**.
- Sandbox, limits and ledger are real. The planner is a fixed script that issues predefined tool calls. It is not an LLM and not the product.
- UI shows a permanent banner: "SCRIPTED PLANNER: no LLM in use. Not the Vultr inference product." `/healthz` returns `inference: absent`. Every ledger and event is tagged `planner: scripted`.
- Purpose: build and test the sandbox, and keep the URL responding. It does not satisfy the Challenge 1 requirement for Serverless Inference.
- Must not appear in the video, slides, cover image or form text as LLM-driven. The video is recorded only with `inference: live`.
- If the key is rejected at runtime, the app does not silently fall back; it shows an error state and says the planner is unavailable.

## Tool calling: documented versus unverified

Documented (rule book s12): tool calling exists on kimi-k2-instruct only; `tool_choice` accepts none, auto, required; messages follow OpenAI-style `tool_calls`; base URL and chat path; bearer auth with the subscription key.
Unverified, test on Day 1: exact model id string in `/v1/models`; response schema details; parallel tool calls; streaming; rate limits; context length; whether tool results role/format matches OpenAI exactly. Design uses sequential single tool calls, non-streaming by default, so it relies on the least.

## Who pays

Candidates, each a hypothesis with no evidence behind it: a team that already pays for analyst time on untrusted exports; a security or platform team that must permit AI agents with code execution only inside a verifiable boundary. Pricing is not set and no price or market figure is claimed. For the hackathon, the cost side is the VM and inference tokens; the demo is rate-limited so it can be funded from the event credit (coverage of inference by the credit is UNVERIFIED).

## What would make a judge call it a wrapper

- A prompt around the model with a code-execution call and no real isolation (or `--network` left on).
- Ledger text that is templated or hand-written rather than measured from the container.
- A scripted planner presented as the agent, or a video recorded in scripted mode.
- The Vultr part reduced to hosting a static page while inference goes to another provider.
- Containment that depends on the model behaving rather than on walls.
- An injection demo where the "attack" was staged to succeed or fail by design.

Counter: inference is the sole decision-maker on each step, the walls are enforced by Docker flags checked in the ledger, and the README includes a reproducible test that runs hostile code directly against the sandbox with the model out of the loop.

## Scope for Day 1 (one person)

In: VM provisioned, backend, one-page UI, hardened `docker run` wrapper, `/healthz`, one inference smoke call, one tool-call round trip, deployed and reachable.
Out: auth, accounts, database, browser sandbox, multi-agent, history.

## Success tests

- External `curl` to the live URL returns the app.
- Hostile code run directly: no network, no env secrets, memory/time kills work, container removed.
- Fresh clone deploys from the README.
- Video contains at least one containment moment.
