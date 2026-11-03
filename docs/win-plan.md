# Win plan: Vultr Agent Rush

Written 2026-11-03. Rule source: docs/competition.md (cited as "rule book"). Anything the rule book marks UNVERIFIED is UNVERIFIED here. Scores below are the planner's own estimates of what to aim for, not predictions and not sourced.

## Decision

Track: **Challenge 1, Blast Radius Zero.**
Working title (placeholder, changeable, not a registered name): **Padded Cell**.

Partner technology that does the work: **Vultr Serverless Inference** (kimi-k2-instruct tool calling drives the agent loop), running on a **Vultr Cloud Compute VM** that also hosts the sandbox. Both are mandatory for this track, so the entry is on-spec by construction, and the inference call is the engine, not decoration.

PRDs: docs/prds/challenge-1-blast-radius-zero.md (chosen), docs/prds/challenge-2-future-of-work.md (rejected, kept as the fallback).

## Why Challenge 1 wins for this builder

1. **Depth of partner use is built into the track.** Challenge 1 requires Cloud Compute, Serverless Inference and isolated execution. A product that is an agent loop over Vultr inference, executing on a Vultr VM, is one coherent stack. Challenge 2 makes Serverless Inference optional (rule book s3), so its natural build uses Vultr only as a place to host a web app. That is the shallow use the brief warns against.
2. **Narrow scope fits one person.** One agent, one or two tools, one hardened Docker runner, one results page. Challenge 2 asks for a workflow platform across sales ops, finance, HR, support or procurement; judged on Business Value, a solo builder either goes broad and thin or picks a vertical and fights many entries that look alike (the number of entries is unknown).
3. **The demo is self-evidently visible.** Containment has a dramatic, checkable moment (an attack is attempted and fails, with evidence on screen). That helps Presentation and is also a mandatory video element.
4. **Originality.** "Show the blast radius as a measured artefact" (a per-run containment ledger) is a clear angle. Generic "AI does back-office workflow" is the likely crowded lane. This is an inference about the field, not a counted fact.

## Why the other track loses

- **Challenge 2 loses on partner depth.** Optional inference means the judges' Application of Technology score has little Vultr-specific to credit unless the builder adds inference anyway, at which point it is a wrapper-risk workflow app with a weaker rule fit than Challenge 1.
- **Challenge 2 loses on Originality risk.** Focus areas (sales ops, finance, HR, support, procurement) are well-trodden agent demos.
- **Challenge 2 wins on one thing: it needs no inference key.** That is its only real advantage, and it is why it stays as the fallback (see Risks, trigger R1).
- Entering both tracks: UNVERIFIED whether allowed (rule book s3). Do not plan on it, and a solo builder should not split effort anyway.

## Scoring against the four named criteria

Weights and scale are UNVERIFIED (rule book s4; default 1 to 5 each from RULES, may be overridden). Plan assumes equal importance only as a working posture, and does not rely on it.

| Criterion | What the judge needs to see | How Padded Cell earns it | Target (estimate) |
|---|---|---|---|
| Application of Technology | Vultr services doing real work, correct use of mandatory pieces | Every agent step is a Vultr Serverless Inference call with kimi-k2-instruct tool calling; code runs in Docker on a Vultr VM; README maps each Vultr service to a function; /healthz shows live mode and model | 4 to 5 |
| Presentation | Clear story, working demo, clean video within limits | Live URL, one-click demo input, 3 minute video built around one containment moment, slides in PDF, cover image | 4 |
| Business Value | A buyer and a reason to pay | Teams that need AI analysis of untrusted files (exports, logs, third-party data) without trusting the agent with their network or secrets; see PRD | 3 to 4 (hardest to prove honestly with no customer evidence) |
| Originality | Not a clone | Containment ledger as the product surface: every run reports what the agent tried and what the walls stopped | 3 to 4 |

Honest gap: Business Value cannot be supported with customer evidence, because there is none. The plan makes no claims about demand; it argues from the job to be done and states that plainly.

## Constraints carried into the build

- Original, MIT-compatible, public repo with licence file and MIT-compatible dependencies (rule book s8).
- README explains Vultr services and infrastructure (rule book s7).
- Video: MP4 or MOV, defaults under 5 minutes and 300MB (defaults not confirmed for this event); must show at least one containment moment (rule book s3).
- Cover image 16:9, slides as PDF, public demo URL. Title max 50 chars and short description max 255 are defaults, not confirmed.
- Nothing is submitted, uploaded or posted by an agent. Alex runs submit.sh.

## Build by day

Dates: 3 to 8 November online build. Submission deadline UNVERIFIED, so the plan is submission-ready by the end of 7 November and treats 8 November as slack and the on-site date, not as a build day.

**Day 1 (3 to 4 Nov): live URL, honest skeleton.**
Goal: a public URL on a Vultr VM that responds, shows its mode, and can run one real sandboxed command.
- Verify Alex has the Vultr account, VM, and inference key (NEEDS 4 to 7). Without a VM there is no URL; stop and say so.
- `GET /v1/models` with the key to confirm the kimi-k2-instruct id and one plain chat call. One tool-call round trip as a smoke test.
- Backend (small, single language, one process) plus a static single-page UI. Reverse proxy with TLS if a domain is available; otherwise HTTP on the VM IP, flagged.
- Sandbox runner: `docker run` with no network, read-only root, tmpfs scratch, memory/CPU/pids limits, wall-clock kill, non-root user, empty environment, removed after run.
- `/healthz` reports: `inference: live|absent`, model id, sandbox runtime.
- Deploy to the VM, hit the URL from outside. This is the day-1 exit test.

**Day 2 (4 to 5 Nov): the agent loop.**
- Tool-calling loop with `run_code` and `read_input_file` tools. Hard cap on steps and tokens.
- Upload real input file (CSV or log) into a read-only mount.
- Stream (or poll) step events to the UI: model request, tool call, sandbox result. (Streaming support is UNVERIFIED; poll if it fails.)
- Decision point R1 at the end of the day (see Risks).

**Day 3 (5 to 6 Nov): containment ledger and the attack demo.**
- Per-run ledger: limits applied, CPU/memory peak if obtainable, exit reason, network attempts blocked, secrets visible inside (expected: none), container destroyed (verified by checking it is gone).
- Prepared hostile input: a real file whose content contains an injected instruction telling the agent to read credentials and call out to a URL. Plus a resource-abuse case (memory or fork loop) that hits a limit.
- Evidence must be produced by the real runner, not scripted text.

**Day 4 (6 to 7 Nov): presentation and hardening.**
- README with architecture, Vultr service map, setup, threat model with what is NOT contained.
- Record the video from the live URL with the live inference key. Cover image, slides PDF.
- Run the fresh-clone test: new VM or clean directory builds from README.
- Draft form text for Alex (title, short and long description). Draft only.

**Day 5 (7 Nov evening): freeze and verify.**
- Feature freeze. Live URL check from a different network. REVIEW.md written. Hand Alex repo URL and form text.
- 8 Nov: buffer, deadline re-check on event page and Discord, Alex submits via submit.sh.

## What to cut (decided now)

- Sandboxed browser use (the second listed pattern). Code execution only.
- Multiple agents, memory, accounts, auth beyond a simple rate-limited public demo, a database (use files or in-memory with a TTL), history across sessions.
- RAG, speech, image models on Vultr inference.
- gVisor or Firecracker hardening unless Day 3 finishes early; it is a stretch and not needed to meet the track (Docker is "strongly recommended").
- Polished design system. One clean page.
- Any claim about performance, cost per run, customers, or market size that has no measurement.

## Risks

| ID | Risk | Likelihood and impact | Mitigation or trigger |
|---|---|---|---|
| R1 | Alex does not supply the inference key by end of Day 2 (midday 5 Nov) | Unknown likelihood; kills Challenge 1 compliance, since Serverless Inference is mandatory | Build proceeds with a clearly labelled scripted planner (below). Trigger: if no key by midday 5 Nov, tell Alex that Challenge 1 cannot be honestly demoed and he decides between pursuing the key harder or switching to the Challenge 2 PRD. Do not disguise the scripted planner as inference. |
| R2 | Inference credit not covered by the $200 (UNVERIFIED) | Unknown; cost, possibly a payment method | Alex checks Usage tab and pricing (NEEDS 8). Cap steps and tokens per run; rate-limit the public demo. |
| R3 | Tool calling flaky or unavailable on kimi-k2-instruct | Medium; documented as supported (rule book s12) but behaviour untested | Day 1 smoke test. Fallback: constrained JSON output parsed by the backend, flagged in README as such. Do not switch models for tool calling; no other model is documented to support it. |
| R4 | Sandbox escape or host exposure by our own design (e.g., mounting the Docker socket into the web container hands the agent host root) | Real; judged on containment, so a hole is fatal to credibility | Run the backend as a host process under a dedicated user allowed to run docker, not as a container with the socket mounted. State residual risk in the threat model. |
| R5 | Public demo abused (crypto mining, outbound attacks) | Medium | No network inside sandbox, tight wall-clock and resource limits, global concurrency cap of 1 to 2 runs, per-IP rate limit, upload size cap. |
| R6 | Deadline earlier than 8 Nov | Unknown (UNVERIFIED) | Submission-ready by end of 7 Nov; Alex checks Discord today (NEEDS 9). |
| R7 | Remote entries may not be prize-eligible (UNVERIFIED) | Unknown | Alex asks organizers on Discord. Does not change the build. |
| R8 | Registration, Discord, team creation not done | Blocks submission only | NEEDS 1 to 3; Alex's action. |
| R9 | Solo time budget | High | Cuts above; the Day-1 exit test is a hard gate. |

## Missing-key behaviour (summary; detail in the PRD)

With no inference key the app runs in **scripted-planner mode**: the sandbox, limits and ledger are real, but the "agent" is a fixed script, not an LLM. The UI shows a persistent banner reading that mode, `/healthz` reports `inference: absent`, and ledger entries are tagged. It is not the real product and is not a Challenge 1 compliant demo. Its sole purposes are to let the sandbox be built and tested, and to keep the URL responding. It must never appear in the demo video, slides, cover image, or form text as if it were LLM-driven.

## Unverified items the build depends on

- Official deadline, weights, scale, remote-prize eligibility (rule book s1, s4, s6).
- Whether the $200 credit pays for inference (s10, s12).
- Streaming, rate limits and full response schema of Vultr inference (s12).
- Whether the inference key or the account key authenticates inference calls (s12); test with the subscription key first.
- Which models besides kimi-k2-instruct exist (s12).
- Whether a single entry can enter both tracks (s3).
