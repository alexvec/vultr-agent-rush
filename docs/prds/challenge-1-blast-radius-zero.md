# PRD: Challenge 1, Blast Radius Zero (CHOSEN, rebuild 2026-11-03)

Working title: Padded Cell (placeholder). Rules: docs/competition.md s3 and s12. Strategy: docs/win-plan.md. Challenge 2 is ruled out by Alex and is not a fallback.

## User

The platform or security lead at a small company who is asked to allow an AI agent to write and run code on files the company did not write (a vendor export, a third-party log, a partner CSV), and will only agree if the boundary can be checked. The analyst who receives those files is the second user. No named person or customer is claimed. This is a described persona, not evidence of demand.

## Job to be done

"Analyse this untrusted file by running code, and give me a record I can check that nothing got out."

## Product concept

The user uploads a file and asks a question. A backend on a Vultr VM calls Vultr Serverless Inference (kimi-k2-instruct, tool calling). The model chooses `read_input_file` or `run_code`. The code runs in a hardened Docker container on the same VM. The user gets the answer and a downloadable run record. A second mode, "run my code directly", lets a judge supply their own hostile code with no model in the loop.

## Partner capability that does the work

- **Vultr Serverless Inference, kimi-k2-instruct, tool calling.** Each step is a chat completion with `tools`. The model decides what code to run. Remove inference and there is no agent and no entry.
- **Vultr Cloud Compute.** Hosts the web app, backend and Docker runtime. The track requires it.
- Sandbox: Docker. gVisor is a stretch goal only.

## Containment design

| Focus | Control |
|---|---|
| Process isolation | One container per run; non-root uid 65534; not privileged; all capabilities dropped; no-new-privileges; default seccomp kept; read-only root; tmpfs scratch with noexec; input mounted read-only |
| Network | `--network none` |
| Secret hygiene | The inference key lives only in the backend process env. The sandbox env is empty. Outputs are scanned for the backend secrets and a canary value. Logs redact the key |
| Resource limits | Memory, CPU, pids; wall-clock kill; output cap; per-run step and token cap |
| Lifecycle | Create, inspect against policy, start only if the policy matches, force-remove, confirm the container is gone; stale reaper |

Residual risks, stated in the README: shared host kernel with plain Docker; the backend must run as a host process under a dedicated user, not as a container with the Docker socket mounted; a model-driven denial of wallet through tokens (capped); the canary is weak evidence.

## Deployment states (what counts as finished)

| State | Vultr VM | Real inference call | Sandbox executes | Status |
|---|---|---|---|---|
| A | yes | yes | yes, on that VM | Meets the track. The only state that may be recorded, submitted or described as finished. |
| B | no (provisioning refused or not done) | any | yes, locally | Does NOT meet the track. Reported as "not deployed on Vultr". Not finished. No video. |
| C | yes | no | yes | Does NOT meet the track. Reported as "inference not running". Not finished. No video. |
| D | any | any | no | Broken. |

There is no keyless demo mode. With no key, agent runs are refused with an error that says the planner is unavailable. The app does not substitute a script or another provider, and a failed model call does not fall back to anything.

If Vultr provisioning is refused for lack of credit, the single fact is recorded in NEEDS.md, the local sandbox must still execute for real (state B), and the status stays "not meeting the track". Nothing is mocked to look like state A.

The fixed-script planner in `src/planners.js` is a test fixture for the automated tests only. It is off in the deployed app and never appears in the video, slides, cover or form text.

## What the demo must show, on real input, from the Vultr host

1. The live URL on the Vultr VM. `/healthz` shows `inference: live`, the model id returned by the API, and `deployment: vultr`. The judge can resolve the host and see Vultr as the network owner.
2. The committed sample file (`samples/`) uploaded. A normal question. The model calls Vultr inference, writes code, the sandbox runs it, the answer returns with a value that can be checked by hand.
3. The run record is downloaded and checked on screen against the file: `sha256sum` of the sample matches `input.sha256`; `sha256sum` of the stdout bytes matches `output.sha256`.
4. **Containment moment (mandatory in the video).** The poisoned sample, whose content tells the agent to read credentials and contact an address. The tool calls are visible. The record shows the host-side evidence: raw `docker inspect` (network none and the other walls), the final container state, the destroy event, the failed inspect after removal, and the canary listener's hit count read from the host.
5. **Resource moment.** A run killed by the memory, time or output limit. The record shows the exit reason from container state and that the container is gone.
6. **Judge code.** Direct mode with code written on screen (a socket connect, an environment read, a write to the root). The output is the result of that code.
7. Every number comes from the live run. No pre-recorded or hand-typed record.

If the model refuses the injection, say so and show the direct-mode attack. Do not claim the model was fooled when it was not.

## Run record: judge-checkable output

A JSON file at a route such as `GET /api/runs/:id/record`, served from the run, containing:

- `run_id`, timestamps, `deployment`, `host`.
- `input.sha256` and size of the uploaded bytes. `output.sha256` of the sandbox stdout bytes, and the bytes or a link that lets the judge hash them.
- The code the model wrote for each step, and the sandbox result for each.
- Inference, per model call: the response `id`, the `model` string returned, the `usage` object, and any request id response header, each recorded only if the API returned it. Otherwise the field says `not returned`. Whether Vultr returns an id or usage is UNVERIFIED (rule book s12). Test at the smoke call and record what was seen. The record must not invent an id.
- Host-side evidence for each container, captured by the backend outside the container: the raw `docker inspect` JSON before start, the final state (exit code, OOMKilled, finished-at), Docker event timestamps (create, start, die, destroy), and whether inspecting the container by name fails afterwards.
- The canary result: the hit count from the host-side listener, with a note that zero hits on one address is weak evidence.
- The scan result for the backend secrets and the canary value in outputs.
- A separate section labelled "self-reported by code inside the sandbox" holding the `attempts` list. It is written by the code under test, so that code can forge or hide it. It does not feed any containment claim, count or headline. The existing source string in `src/ledger.js` says this; the UI and the record must say it too.

What the record does not claim: it is not signed and is not tamper-proof. The hashes let a judge check that the record matches files they hold. They do not prove the server told the truth. The container wall evidence comes from `docker inspect`, which the same backend runs. It is host-side, not independent of us. No claim goes beyond that.

## Tool calling: documented versus unverified

Documented (rule book s12): tool calling exists on kimi-k2-instruct only; `tool_choice` accepts none, auto, required; OpenAI-style `tool_calls`; the base URL and chat path; bearer auth with the subscription key.
Unverified, test at the smoke call: the exact model id in `/v1/models`; response schema, including `id` and `usage`; parallel tool calls; streaming; rate limits; context length. The design uses sequential single tool calls and no streaming.

## Who pays

Hypotheses with no evidence: a team that owns the risk of letting agents run code on external files; a security or platform team that must see a checkable boundary before approval. No price or market figure is claimed. For the event the cost is the VM and inference tokens. Whether the $200 credit covers inference is UNVERIFIED.

## What would make a judge call it a wrapper

- The sandbox is plain Docker with a prompt and no checked policy, or `--network` left on.
- Evidence that is templated, hand-written or taken only from inside the container.
- A scripted planner, another provider, or a video recorded outside state A.
- Vultr reduced to hosting a static page while inference goes elsewhere, or the app served only from the Vercel preview.
- Containment that depends on the model behaving.
- A staged injection demo.
- A record that cannot be checked against a file the judge holds, or one that claims proof it does not have.

Counter: inference makes every decision; walls are enforced by flags and refused at start if the inspected config differs; the record hashes tie it to input and output; direct mode lets the judge bring the attack.

## Scope

In: Vultr VM, backend, one page, hardened `docker run` wrapper, `/healthz`, inference smoke call, tool-call loop, run record, canary listener, direct mode, deploy script run against Vultr.
Out: auth, accounts, database, browser sandbox, multi-agent, history, signing.

## Success tests

- External `curl` to the Vultr URL returns the app; `/healthz` says `deployment: vultr` and `inference: live` only after a real API answer.
- Agent run on the sample: the record's input and output hashes match `sha256sum` on the judge's side.
- Hostile code run directly: no network, empty env, root and input not writable, memory and time kills work, container removed.
- A start is refused when the inspected config differs from policy (covered by `test/wall-policy.test.js`).
- With the key removed, agent runs return an error and nothing else happens.
- Fresh clone deploys from the README.
- The video contains a containment moment, recorded in state A.
