# Win plan: Vultr Agent Rush

Rewritten 2026-11-03 for the rebuild Alex ordered (NEEDS.md, "Rebuild order"). Rule source: docs/competition.md (the "rule book"). Anything the rule book marks UNVERIFIED is UNVERIFIED here. Scores are the planner's estimates of what to aim for, not predictions and not sourced. Where the event page and this plan conflict, the event page wins.

## Decision

Track: **Challenge 1, Blast Radius Zero.** Alex ruled out Challenge 2. It is not a fallback, and nothing in this plan switches to it.

Working title (placeholder, not a registered name): **Padded Cell**.

Keep the existing product and code base. The review of the code (below) found a real hardened sandbox, a wall policy checked against `docker inspect`, and an LLM planner with no silent fallback. That part would not lose. What loses today is that none of it runs on Vultr and inference has never run. The rebuild is deployment and evidence work, not a new product.

The product, in one line: **upload an untrusted file and a question, a Vultr Serverless Inference agent plans and writes code, the code executes inside a locked Docker sandbox on a Vultr VM, and the judge downloads a run record they can check.**

Partner technology that does the work: Vultr Serverless Inference (kimi-k2-instruct tool calling decides every step) on a Vultr Cloud Compute VM that hosts the web app, the backend and the sandbox. All three are mandatory for this track (rule book s3).

## The one buyer and the one job

- Buyer: the platform or security lead at a small company who must approve "AI agents that run code on files we did not write" and will only approve it if the boundary can be verified, not promised. A second, weaker reading is the analyst who receives the files. No named customer exists and none is claimed. This is a described persona, not evidence of demand.
- Job: "Analyse this untrusted file by running code, and give me a record I can check that nothing got out."
- Who pays (hypothesis, no evidence): the team that owns the risk of agent code execution. No price and no market figure is claimed.

## Gallery position (honest)

Checked 2026-11-03 (rule book, "Event gallery"). The event page, the live page and our own team page show no submissions listing. Result: the gallery is empty or unreachable. The fetch tool summarises pages, so a client-rendered gallery could have been missed. That is UNVERIFIED either way.

What this means:
- We cannot say our job is different from every other entry. We can only say it is not the same as any project we could see, because we could see none.
- The live page reports 2,201 registered builders and 550 teams forming (reported by the fetch tool). Sandboxed code execution is a pattern the event page itself lists, so other teams will very likely build something near this. Treat overlap as probable.
- Action for the builder and Alex: reopen the gallery on 6 Nov and 8 Nov in a real browser, not the summarising tool. If a project does the same job (untrusted file, LLM agent, Docker sandbox, containment report), the differentiator below has to carry the entry alone.

## Past winners and how this product differs

All of these are a different event, not an earlier Agent Rush. No earlier Agent Rush was found (rule book, Past winners B). Only what is recorded in docs/competition.md is used. No metrics from any winner project were recorded, so none are quoted.

RAISE YOUR HACK 2025, Vultr track (different event), placings per the Vultr blog https://blogs.vultr.com/vultr-at-RAISE-2025:

| Place | Project | Job per the blog | How Padded Cell differs |
|---|---|---|---|
| 1st | Unmask | Helps hiring teams verify resumes, identities and interview data | Different buyer and job. Unmask is a credibility checker. Padded Cell runs untrusted code under containment. |
| 2nd | Onboard-Me | Turns internal documents into adaptive onboarding | Different job. It is a document-to-content tool. Ours produces executed results plus a run record. |
| 3rd (tie) | Axiom Prime | Monitors infrastructure and diagnoses issues | Nearest in spirit because it is agentic infrastructure work. It observes systems. Ours executes hostile input and reports the boundary. A search snippet saying it ran on a Vultr Bare Metal instance is unverified. |
| 3rd (tie) | Ringy | Transcribes and processes support calls in real time, Groq-powered, on Vultr infrastructure | Different job. Ringy used Vultr for infrastructure per the blog. Ours uses Vultr inference for the agent decisions. |
| "Runner-up" | Office Brainstorm | Simulation tool for workplace challenges | Different job. |

Unmask is the only winner whose project page was opened (https://lablab.ai/ai-hackathons/raise-your-hack/le-commit-unmask-vultr-track/unmask). The page says it was "deployed on Vultr using a modular agent pipeline" and names the Llama via Groq API and ElevenLabs as the capabilities doing the work. Vultr was hosting. It lists a live demo, a public repo and a presentation PDF. Those links were not opened, so what a judge saw is UNVERIFIED. The other four project pages were not opened, so how they used Vultr is UNVERIFIED.

Also a different event: Milan AI Week results (1st Deals Machine: The Autonomous Sales Agent, 2nd ContextGuard - Live Decision Helper, 3rd Cascade AI). The page gave no descriptions, so no comparison is possible and none is made. No containment-first or sandbox winner was confirmed anywhere (rule book, Past winners C).

Lessons that carry over (our inference from a single opened page and a blog, not proof of what judges reward):
1. The opened winner was a working, deployed web app with a live URL, a public repo and slides. The packet has to be complete and the URL has to work for a judge who arrives cold. A preview on another host does not count.
2. It had one clear buyer and a plain job. Keep ours to one sentence.
3. Its Vultr use was hosting only, per its own page. A real, load-bearing use of Vultr Serverless Inference with a visible output is a gap worth taking, but nothing recorded shows judges reward depth. Do not claim they do.
4. Nothing recorded says what the winning videos showed. Do not guess.

How this product differs in substance: the sponsor capability is the decision-maker on every step (not hosting), the output is a downloadable record a judge can check against files they hold, and the claim is limited to what is measured outside the container where possible.

## Differentiator, honestly sized

The differentiator is the run record: host-side evidence of what the sandbox was configured to be and how each container ended, with hashes tying the record to the input and the output, plus a mode where the judge supplies their own hostile code. It is a moderate differentiator, not a unique one. Another team can run Docker with `--network none`. What is harder to copy quickly is the discipline: refusing to start a container whose inspected config differs from policy, reporting self-reported data as self-reported, and failing loudly instead of faking a mode.

Weakness to state plainly: the `attempts` section of the ledger is written by code inside the sandbox (`src/sandbox.js` `splitAudit`, `src/ledger.js`). Hostile code can forge or suppress it. It must never be the evidence for a containment claim.

## Would it lose if inference never runs?

Yes. Plainly.
- Serverless Inference is required for this track (rule book s3). Without a live call, the entry fails a mandatory requirement. Application of Technology, the criterion about how effectively the chosen models are integrated, has nothing to score.
- Without the model, what remains is a generic Docker runner with a report. That is the shallow product the brief rejects, and it is the most likely thing to be duplicated in the gallery.
- The existing scripted planner is not a rescue. It ignores the question and runs a fixed program. It is a test fixture and may not be shown to a judge as the demo.
- The same applies if inference runs but the app is not on a Vultr VM. The Vercel preview is not the demo and does not meet the track.

So the strategy box is ticked on the condition that the build gets a Vultr VM and a working inference key. If either is refused, the entry does not meet the track and is reported as such (see Gates). That is a status to report, not a plan to ship.

## Scoring against the four published criteria

The event page lists four criteria with one-line descriptions and no weights or scale (rule book s4, D). The rules page says many events score each 1 to 5, but the event page does not adopt that. So the plan uses the four names and does not rely on a 1 to 5 scale or on weights.

| Criterion (event page wording) | What the judge needs to see | How the entry earns it | Estimate |
|---|---|---|---|
| Application of Technology (how effectively the chosen models are integrated) | Vultr inference doing the work, correct use of the mandatory pieces | Every agent step is a Vultr chat completion with tool calls. The code runs on the Vultr VM. The record carries the inference response id and usage if the API returns them | 4 to 5 once live; 1 if inference does not run |
| Presentation (clarity and effectiveness) | A working demo from a cold start, clean video | Live Vultr URL, one-click sample, video built around one containment moment recorded on the Vultr host | 4 |
| Business Value (impact, practical value, fit with business areas) | A buyer and a reason to pay | Platform and security lead; argued from the job, no demand evidence | 3 (hardest to support honestly) |
| Originality (uniqueness and creativity) | Not a clone | Checkable run record; refusal to start a non-compliant container; judge-supplied hostile code | 3, lower if the gallery holds the same job |

## What a judge can check on the live URL without trusting our text

Each item says how. Items needing the live Vultr deployment are marked as not yet true until built.

1. The host is Vultr. Resolve the demo hostname or IP and look up the network owner (whois or an ASN lookup). The owner should be Vultr. This does not depend on anything we print.
2. Input binding. The sample file is committed in the repo (`samples/`). Run `sha256sum` on it and compare to `input.sha256` in the downloaded run record.
3. Output binding. The record contains the code the model wrote and the sandbox stdout. The judge runs `sha256sum` over the stated output bytes and compares to `output.sha256`. They can also re-run the shown code on the sample on their own machine and compare the number to the answer. For the sample CSV, a sum or count can be checked by hand.
4. Judge-supplied code. A "run my code directly" mode takes code the judge writes: try a socket connect, read the environment, write to the root filesystem, allocate memory, fork. The judge sees the result of their own code, so they do not need to trust our description. This is also the check that does not depend on the model.
5. Outside-the-container evidence in the record: the raw `docker inspect` JSON captured before start (network mode, read-only root, cap drop, limits, mounts, user), and after exit the final state (exit code, OOMKilled), the Docker event timestamps for create, start, die, destroy, and the confirmation that inspecting the container by name fails. The judge reads the raw JSON, not our summary of it.
6. Canary. The VM runs a listener that logs any connection. The attack file tells the agent to contact that address. The record reports the listener's hit count, read from the host. Zero hits supports "nothing left". It does not prove it, because absence of a hit on one address is weak evidence, and the plan says so.
7. Inference. The record shows the inference response id, the model string returned and the usage object if the API returns them. The response schema is UNVERIFIED (rule book s12), so if a field is missing the record says "not returned" and the claim is dropped. The judge can compare the token usage to the size of the transcript in the record. The Vultr console Usage tab would corroborate, but only Alex can see it, so it is not independent evidence for a judge.
8. Reproduce. The README gives the exact `docker create` flags. A judge with Docker can run the same hostile code against the same flags.
9. The Vercel preview is labelled as not the demo and its `/healthz` says execution is disabled. The judge should not be pointed to it.

What the record does not give: signing. The hashes let a judge confirm the record is consistent with files they hold. They do not prove our server told the truth, and nobody can verify an unsigned file against our server. The plan claims no tamper-proofing. An HMAC with a key only we hold would not help a judge, so none is added for show.

## Gates for the rebuild

- G1 (today, 3 Nov): check the Vultr billing balance. Create a VM and a Serverless Inference subscription if the account can provision without a card. Do not apply HACKATHON again and do not link a card (NEEDS.md). If provisioning refuses for lack of credit, record that single fact in NEEDS.md and keep going.
- G2: `GET /v1/models` with the inference key; confirm the kimi-k2-instruct id; one plain chat call; one tool-call round trip. Record the response fields actually returned.
- G3: deploy to the VM; fetch the URL from another network; `/healthz` reports `inference: live`, the model id, `host: vultr` and execution enabled.
- G4: one real agent run on the sample, record downloaded and every hash checked by hand.
- G5: the poisoned file and a resource-kill run, both from the live host.

If Vultr provisioning is refused: the sandbox is still real and runs locally, but the status is "does not meet the track: not deployed on Vultr" or "inference not run", not "finished". No demo video is recorded in that state. Alex decides what happens next. Switching to Challenge 2 is not an option the plan offers.

## Constraints carried into the build

- Original, MIT-compatible, public repo, licence file, MIT-compatible dependencies (rule book s8).
- README explains the Vultr services and infrastructure (rule book s7).
- Video: defaults under 5 minutes and 300MB as MP4 or MOV (defaults, not confirmed for this event). It must show at least one containment moment (rule book s3), recorded from the Vultr host with `inference: live`.
- Cover image 16:9, slides as PDF, public demo URL. Title 50 characters and short description 255 are defaults, not confirmed.
- Nothing is submitted, uploaded or posted by an agent. Alex runs submit.sh.

## Deadline

The live page says "You have until Nov 8, 2026, 22:00 UTC to submit." (rule book, Past winners B). The event page gives no deadline. Treat 22:00 UTC on 8 Nov as the working deadline and recheck it on the submission form before Alex submits. Today is 2026-11-03. Plan to be submission-ready by the end of 7 Nov (UTC), so 8 Nov is slack and the on-site date, not a build day. The rules page gives a five-minute grace period by default (rule book s1), which the plan does not rely on.

## Schedule

- 3 Nov: G1 and G2. Without a Vultr VM and a live inference call there is no entry; report that at once.
- 4 Nov: G3 deployment, builder changes below, `/healthz` honesty.
- 5 Nov: G4, G5; run record complete; hostile cases from the live host.
- 6 Nov: README, video from the Vultr host, slides, cover image, form text drafts. Reopen the gallery in a browser.
- 7 Nov: freeze, fresh-clone test, check from another network, REVIEW.md, hand Alex the repo URL and form text.
- 8 Nov: recheck the deadline on the form. Alex submits.

## What to cut

Sandboxed browser use; multi-agent; accounts and database; RAG, speech, image models; gVisor or Firecracker unless everything else is done; any claim about performance, cost per run, customers or market size without a measurement.

## Changes the builder must make to the existing code

The code changes here were made in commit 38b5008. Running the deploy on Vultr is still open.

1. `src/webapp.js` and `src/planners.js`: the scripted planner is not a demo mode. With no key the public app must refuse agent runs with a clear error, not enter a bannered scripted mode. Keep `ScriptedPlanner` only as a test fixture, enabled by an explicit test flag that is off in `deploy/`. `/healthz` must never say `live` unless a real call has succeeded (it already waits for that; keep it).
2. `/healthz`: add `host` (vultr or not) and `deployment`. Set it from an explicit env var written by `deploy/deploy.sh`, and report `deployment: not-vultr, track requirement NOT met` otherwise. Do not infer Vultr from anything the page can fake.
3. `src/inference.js`: return the response `id`, the `model` string, `usage`, and any request id header if present, per call, without assuming they exist. Record "not returned" otherwise.
4. `src/ledger.js`: add a downloadable run record (new route such as `GET /api/runs/:id/record`) with the sha256 of the uploaded input and of the sandbox output, the code the model wrote, the model transcript hashes, the raw `docker inspect` JSON captured before start and after exit, Docker event timestamps (create, start, die, destroy), and the post-removal check. Capture these in `src/sandbox.js` on the host side.
5. `src/ledger.js`: rename `attempts` consumers in the UI and record so self-reported data is shown under a "self-reported by code in the sandbox" label and never counted toward a containment claim. Keep the existing source string. Containment claims must be driven by the inspect-based `walls` and the canary count.
6. Canary: add a host-side listener on the VM that logs connections, plus a canary secret value scanned for in outputs (the secret scan exists). Report the hit count in the record. State the limits of the canary in the README.
7. Direct mode (`/api/runs/direct`) stays public and rate-limited, since it is the check that does not depend on the model.
8. Docs: `README.md` line 85 and line 98 describe scripted mode as a mode of the app. Rewrite them to say the app refuses to run agent mode without a key, and describe the deployment states. `docs/demo-script.md` already forbids scripted mode; keep that.
9. The `deploy/` scripts have never been run against Vultr. Run them, fix what breaks, and fill `url:` in STATE.md only when the app answers on the Vultr VM.
10. Docker on this Mac is down (NEEDS item 11). The tests that matter (`test/sandbox-walls.test.js`) must pass on the Vultr VM itself if they cannot run locally.

## Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | No inference key, or provisioning refused for credit | Record the single fact. Local sandbox stays real. Status is "track not met". No Challenge 2 switch. Alex decides how to obtain credit. |
| R2 | The $200 credit may not pay for inference (UNVERIFIED) | Check the Usage tab after provisioning. Cap steps and tokens per run. Rate-limit the public demo. |
| R3 | Tool calling flaky on kimi-k2-instruct | Smoke test at G2. Fallback is constrained JSON output parsed by the backend, flagged in the record. Do not switch models for tool calling. |
| R4 | Our own sandbox hole (Docker socket in a container, etc.) | Backend runs as a host process under a dedicated user. Residual risk stated in the README. |
| R5 | Public demo abused | No network in the sandbox, tight limits, concurrency cap, per-IP rate limit, upload cap. |
| R6 | The model refuses the injection | Say so. Use direct mode so the walls are still tested. Do not claim the model was fooled. |
| R7 | Another team has the same job | Gallery recheck on 6 and 8 Nov in a browser; the record and judge-supplied code carry the entry. |
| R8 | Deadline differs from the live page | Recheck on the form. |
| R9 | Remote entries may not be prize-eligible (UNVERIFIED) | Alex asks organizers on Discord. No build change. |
| R10 | Solo time budget, five days | The gates are hard. Cuts above. |

## Unverified items the build depends on

- Weights, scale and per-track criteria (rule book s4, D). Remote-prize eligibility (s6).
- Whether the $200 credit pays for inference (s10, s12).
- Vultr inference streaming, rate limits and full response schema, including whether a response id or request id is returned (s12).
- Whether the subscription key or the account key authenticates inference (s12); test the subscription key first.
- Which models besides kimi-k2-instruct exist (s12).
- Whether one entry can enter both tracks (s3). Moot, since Challenge 2 is ruled out.
- Gallery contents (Event gallery section).
