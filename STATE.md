# State

- slug: vultr-agent-rush
- stage: rebuild (Challenge 1 stands; the live demo must execute on Vultr, and the earlier packet is void)
- track: Challenge 1, Blast Radius Zero (Challenge 2 ruled out by Alex; no fallback). Working deadline: Nov 8, 2026, 22:00 UTC (a later read showed 23:00; confirm on the form) per the live page, recheck on the submission form.
- repo: https://github.com/alexvec/vultr-agent-rush
- url:
- preview (not the demo URL, not on Vultr, execution disabled, does not satisfy the track): https://padded-cell-preview.vercel.app

## Current status (rebuild run, 2026-11-03; overrides anything older below)

- Verifier verdict: FAIL. Vultr Serverless Inference has never run, there is no Vultr VM and no live URL.
- Real and passing locally: Docker sandbox, 62 of 62 tests, demo walkthrough without its agent steps, one hostile direct-mode run in docs/evidence/.
- Docker is up. Older notes that say it is down are history.
- The Vultr account is reported by Alex to exist. It is not signed in in the connected Chrome, so the agent has not seen it. HACKATHON has not been applied by any run recorded here.
- Next: Alex signs in or supplies a key and VM, then resume. See the top of NEEDS.md.

## Stages

- [x] research
- [x] strategy
- [ ] needs-cleared
- [ ] build
- [x] presentation (drafted 2026-11-03; not exportable or recordable until the app is live on Vultr, see the checklist in docs/submission.md)
- [ ] verify

## Operator must supply (recorded at needs-cleared, 2026-11-03)

Checked in this environment: no VULTR or inference variable is set, and vultr-cli is not installed. No Vultr account or inference key is available to the build. gh is logged in as alexvec, and Docker runs locally.

- Blocking the real product until the agent creates them: a Vultr account, a VM, and a Serverless Inference key (NEEDS items 4-7). A payment card still waits for Alex, and only if provisioning refuses without one.
- Blocking submission only: Discord if the site still requires it (NEEDS item 2), video, submit (item 10). Team Windboy exists at https://lablab.ai/ai-hackathons/vultr-hackathon/windboy. Alex registered and is the admin.
- Decision: continue the build. Superseded 2026-11-03: a keyless scripted mode is not a demo and does not meet the track (docs/win-plan.md, docs/prds/challenge-1-blast-radius-zero.md). Without a Vultr VM and a live inference call the entry is reported as not meeting the track.

## Build status (2026-11-03)

Live: only the labelled Vercel preview, which serves the page and /healthz with code execution disabled and no inference. Not live: anything on Vultr, any real inference call, any sandbox on a public host. `url:` stays empty until the app is on a Vultr VM.

Build stays unticked: the sponsor capability has never run on real input on a live URL. See "Rebuild run, what has run" below, which replaces the earlier test status here.

## Director note (2026-11-03)

Builder finished. Build stays unticked, and the run moved on to presentation so that the packet exists. The Docker engine was still down when rechecked.

CLAUDE.md, AGENTS.md and NEEDS.md changed during this run to say the agent creates accounts. This run was launched with "do not register" and record-for-the-operator limits. It created no Vultr account, redeemed no credit and provisioned no VM. NEEDS items 4, 5 and 7 are therefore not done, despite their wording. Alex decides whether a resume does them.

## Verify, first run (2026-11-03; void, replaced by the rebuild review)

The verifier ran and REVIEW.md exists. Its verdict is not ready to submit, so the verify box stays unticked. Re-run the verifier after the app is live on Vultr. Packet: reviews/vultr-agent-rush.md in the ops directory

## Second run (2026-11-03)

The account already exists. The gift code has not been shared. Do not apply HACKATHON and do not link a card. Build and verify stay unticked until the sandbox executes for real.

## Rebuild run, needs check (2026-11-03)

Vultr console not signed in in the connected Chrome, so no balance read, no provisioning, no key. See the top of NEEDS.md. Docker Desktop was restarted (stuck processes ended, app reopened); no data was reset or pruned. The engine is up. Other projects' containers restarted with it. needs-cleared stays unticked. The build continues on a real local sandbox, which does not meet the track.

## Rebuild run, what has run (2026-11-03)

Build stays unticked, because the app does not meet "sponsor capability runs on real input on a live URL". Measured locally on a Mac at commit 38b5008, Docker Desktop engine 29.1.3, no inference key: `npm test` 62 of 62 passed with a local stub standing in for the model; `npm run demo` passed, with agent steps refused rather than walked; one hostile direct-mode run through the HTTP API, recorded in docs/evidence/local-direct-run.json. The sandbox image was not rebuilt, because the Dockerfile is unchanged and the runner and probe in the image match the source by hash.

Never run: any call to Vultr Serverless Inference, any Vultr VM, deploy/deploy.sh and deploy/provision.sh, the app's agent path with a real model, the walkthrough's steps 2 and 3. `url:` stays empty. The Vercel preview was not redeployed, so it still serves the older page and /healthz fields.
