# State

- slug: vultr-agent-rush
- stage: build
- track: Challenge 1, Blast Radius Zero (fallback: Challenge 2, only if the inference key cannot be obtained; see docs/win-plan.md R1)
- repo: https://github.com/alexvec/vultr-agent-rush
- url:
- preview (not the demo URL, not on Vultr, execution disabled, does not satisfy the track): https://padded-cell-preview.vercel.app

## Stages

- [x] research
- [x] strategy
- [x] needs-cleared
- [ ] build
- [ ] presentation
- [ ] verify

## Operator must supply (recorded at needs-cleared, 2026-11-03)

Checked in this environment: no VULTR or inference variable is set, and vultr-cli is not installed. No Vultr account or inference key is available to the build. gh is logged in as alexvec, and Docker runs locally.

- Blocking the real product until the agent creates them: a Vultr account, a VM, and a Serverless Inference key (NEEDS items 4-7). A payment card still waits for Alex, and only if provisioning refuses without one.
- Blocking submission only: Discord if the site still requires it (NEEDS item 2), video, submit (item 10). Team Windboy exists at https://lablab.ai/ai-hackathons/vultr-hackathon/windboy. Alex registered and is the admin.
- Decision: continue the build. The app runs without a key in a labelled scripted mode, so a missing credential does not make it impossible to run.

## Build status (2026-11-03)

Live: only the labelled Vercel preview, which serves the page and /healthz with code execution disabled and no inference. Not live: anything on Vultr, any real inference call, any sandbox on a public host. `url:` stays empty until the app is on a Vultr VM.

Build stays unticked: the repo is public, but tests have not fully passed on the final code. Docker Desktop's engine stopped mid-build (NEEDS item 11). Tick it after `npm run sandbox:build && npm test` passes.
