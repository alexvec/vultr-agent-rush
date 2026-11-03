# State

- slug: vultr-agent-rush
- stage: rebuild (Challenge 1 stands; the live demo must execute on Vultr, and the earlier packet is void)
- track: Challenge 1, Blast Radius Zero (Challenge 2 ruled out by Alex; no fallback). Working deadline: Nov 8, 2026, 22:00 UTC per the live page, recheck on the submission form.
- repo: https://github.com/alexvec/vultr-agent-rush
- url:
- preview (not the demo URL, not on Vultr, execution disabled, does not satisfy the track): https://padded-cell-preview.vercel.app

## Stages

- [x] research
- [x] strategy
- [ ] needs-cleared
- [ ] build
- [ ] presentation
- [ ] verify

## Operator must supply (recorded at needs-cleared, 2026-11-03)

Checked in this environment: no VULTR or inference variable is set, and vultr-cli is not installed. No Vultr account or inference key is available to the build. gh is logged in as alexvec, and Docker runs locally.

- Blocking the real product until the agent creates them: a Vultr account, a VM, and a Serverless Inference key (NEEDS items 4-7). A payment card still waits for Alex, and only if provisioning refuses without one.
- Blocking submission only: Discord if the site still requires it (NEEDS item 2), video, submit (item 10). Team Windboy exists at https://lablab.ai/ai-hackathons/vultr-hackathon/windboy. Alex registered and is the admin.
- Decision: continue the build. Superseded 2026-11-03: a keyless scripted mode is not a demo and does not meet the track (docs/win-plan.md, docs/prds/challenge-1-blast-radius-zero.md). Without a Vultr VM and a live inference call the entry is reported as not meeting the track.

## Build status (2026-11-03)

Live: only the labelled Vercel preview, which serves the page and /healthz with code execution disabled and no inference. Not live: anything on Vultr, any real inference call, any sandbox on a public host. `url:` stays empty until the app is on a Vultr VM.

Build stays unticked: the repo is public, but tests have not fully passed on the final code. Docker Desktop's engine stopped mid-build (NEEDS item 11). Tick it after `npm run sandbox:build && npm test` passes.

## Director note (2026-11-03)

Builder finished. Build stays unticked, and the run moved on to presentation so that the packet exists. The Docker engine was still down when rechecked.

CLAUDE.md, AGENTS.md and NEEDS.md changed during this run to say the agent creates accounts. This run was launched with "do not register" and record-for-the-operator limits. It created no Vultr account, redeemed no credit and provisioned no VM. NEEDS items 4, 5 and 7 are therefore not done, despite their wording. Alex decides whether a resume does them.

## Verify (2026-11-03)

The verifier ran and REVIEW.md exists. Its verdict is not ready to submit, so the verify box stays unticked. Re-run the verifier after the app is live on Vultr. Packet: reviews/vultr-agent-rush.md in the ops directory

## Second run (2026-11-03)

The account already exists. The gift code has not been shared. Do not apply HACKATHON and do not link a card. Build and verify stay unticked until the sandbox executes for real.

## Rebuild run, needs check (2026-11-03)

Vultr console not signed in in the connected Chrome, so no balance read, no provisioning, no key. See the top of NEEDS.md. Docker Desktop was restarted (stuck processes ended, app reopened); no data was reset or pruned. The engine is up. Other projects' containers restarted with it. needs-cleared stays unticked. The build continues on a real local sandbox, which does not meet the track.

