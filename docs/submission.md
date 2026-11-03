# Submission text: Padded Cell (Challenge 1, Blast Radius Zero)

Paste-ready text for the lablab.ai form, written for the state after the app is live on Vultr. **Most of the product claims below are not true today**, including the short description. Do not paste anything until the checklist is cleared or the statement it covers is removed. Nothing here has been submitted, uploaded or posted. Alex submits.

## PRE-SUBMIT CHECKLIST (read first)

State on 2026-11-03: no Vultr VM, no Serverless Inference key, and no live URL exist. Serverless Inference, `deploy/deploy.sh` and `deploy/provision.sh` have never run. The agent loop has only met a local stub model. The only running deployment is the Vercel preview, https://padded-cell-preview.vercel.app. It has code execution disabled and no inference, it is not on Vultr, and it must not be entered as the demo URL.

What is true today (measured locally on a Mac, Docker Desktop, commit `38b5008`, see README "Current status"): `npm test` 62 of 62 with a stub model; `npm run demo` 1 of 1 with the agent steps skipped; one hostile direct-mode run with no model, `docs/evidence/local-direct-run.json`, with its limits in `docs/evidence/README.md`.

| # | Statement in the text below that is not yet true | What must happen first |
|---|---|---|
| 1 | **Short description:** "A Vultr Serverless Inference agent writes code" and "on a Vultr VM" | Both halves have never run. Needs items 2 and 3 below. If either cannot be done, replace the short description with text that says what exists, and say plainly that the entry does not meet the track |
| 2 | "Every decision the agent makes is a Vultr Serverless Inference call"; the model name `kimi-k2-instruct` (long description, slides, video) | A Vultr account, credit and an inference key (NEEDS items 4, 5, 7). Then `node --env-file=.env scripts/smoke-inference.js`. Confirm the real model id from `/v1/models`, the response schema and a tool-call round trip. The client has only met a local stub. Fix the client and the text if the API differs. Coverage of inference by the $200 credit is unverified |
| 3 | "run on one Vultr Cloud Compute VM behind Caddy"; the demo URL | Provision an Ubuntu 24.04 VM and run `deploy/deploy.sh root@<vm-ip>` with the key. The scripts were only syntax-checked. Expect to fix something |
| 4 | Live URL works | From another network, `/healthz` must show `inference: live`, `inference_verified_by: chat_completion`, `deployment: vultr-vm`, `sandbox.execution: enabled` and `track.status: met_according_to_label`. `inference_verified_by` stays `models_list_only` and `track` stays `not_met` until one agent run has made a real chat completion in this process, and both reset on restart. `deployment` is a label the deploy script writes (`deployment_basis` says so), so also look up the network owner of the hostname. Then replace `[LIVE_VULTR_URL]` everywhere and set `url:` in STATE.md |
| 5 | "look up the network owner of the demo hostname to see that the host is Vultr" | True only if the hostname resolves to a Vultr address. Check with a whois or ASN lookup. A `sslip.io` name resolves to the VM address, so look up that address |
| 6 | The run record's `inference` details "the API returned" | Whether Vultr returns a response id, `usage` or a request id header is unverified. The record prints `not returned` for a missing field. Look at a real record, and drop the words if nothing came back |
| 7 | The poisoned-file paragraph | Check what the real model did with it. The video and slides must say exactly that. If it refused, the text is already worded for that, and the direct-mode attack carries the containment moment |
| 8 | Hash and removal claims | True of the local record in `docs/evidence/`. Re-do the checks on a record downloaded from the live host before saying so about the deployment |
| 9 | "Spend is capped per run and per hour" | True in code (8 steps, 20,000 tokens, 180 s per run; 30 model-driven runs per hour). Whether the credit covers inference is unverified (Usage tab) |
| 10 | Video, slides and cover | Record on the Vultr host with a real model (docs/demo-script.md). Export docs/slides.md to PDF after the `[...]` markers are resolved and any statement in it that is not true is removed. Fill `[VIDEO_URL]` and `[SLIDES_PDF_PATH]`. Alex uploads them |
| 11 | Slide claim that no other project in the event gallery was visible | Dated 2026-11-03 from a summarising fetch tool. Reopen the gallery in a real browser before export and edit or drop the line |
| 12 | Deadline | The live page said Nov 8 2026, 22:00 UTC, then 23:00 UTC on a later read (docs/competition.md). The event page gives none. Recheck on the submission form |
| 13 | Field limits | The event page lists none. The limits below are lablab defaults (title 50, short description 255, long description at least 100 words, video under 5 minutes and 300MB, PDF slides). Check the form |
| 14 | Counts below | Counted by hand twice, not by tool. Re-count after pasting with `pbpaste \| wc -m` (characters) and `pbpaste \| wc -w` (words), and fix any difference |

## Form fields (docs/competition.md s7)

### Project title (default limit: 50 characters)

```
Padded Cell: Blast Radius Zero for AI Agents
```

44 characters. "Padded Cell" is a working title, not a registered name. Not affected by the checklist.

### Short description (default limit: 255 characters)

```
Upload a file you do not trust. A Vultr Serverless Inference agent writes code, which runs in a locked Docker sandbox on a Vultr VM. You download a run record with host-side evidence and hashes you can check against files you hold.
```

231 characters and 42 words, counted by hand two ways: four sentences of 31, 47, 52 and 98 characters plus 3 separating spaces, and 190 letters plus 41 spaces. The limit is 255. Not true until checklist rows 1 to 3 are closed.

### Long description (default minimum: 100 words; no maximum is stated)

```
Padded Cell is an AI agent for files you do not trust. You upload a file, such as a vendor export or a third-party log, and ask a question. The agent answers by writing Python and running it. Every run ends with a downloadable run record that you can check against files you hold.

Every decision the agent makes is a Vultr Serverless Inference call. The backend sends chat completions to kimi-k2-instruct, the model Vultr documents for tool calling, with two tools, read_input_file and run_code, and the model chooses each step. Without the inference there is no agent. The backend, the web app and the Docker runtime run on one Vultr Cloud Compute VM behind Caddy.

Code runs only in a hardened Docker container: no network, read-only root filesystem, empty environment, all capabilities dropped, non-root user, 128 MiB of memory with no swap, half a CPU, 32 processes and a 10 second wall clock. Before each container starts, the backend reads docker inspect and refuses to start it if it does not match the policy. After each run the container is force-removed and its absence is checked. The inference key lives only in the backend process.

The run record separates evidence from self-report. The wall settings, the container's final state, the create, start, die and destroy timestamps, and the failed inspect after removal are captured by the backend from the Docker daemon, outside the container. The record also holds the sha256 of the uploaded bytes and of the program's output, the code the model wrote, and the inference response details the API returned. A list of attempts written from inside the sandbox is labelled self-reported, because hostile code can forge it, and no containment claim uses it. A listener outside the sandbox counts connections as a canary. Zero hits is weak evidence, and the record says so. The record is not signed, and its host-side values come from docker commands the same backend ran, so the hashes tie it to files you hold but do not prove the server told the truth.

You can check the result yourself. Hash the sample file in the repo and compare it with input.sha256, decode output.base64 and compare its hash with output.sha256, and look up the network owner of the demo hostname to see that the host is Vultr. A direct mode runs code you write, with no model in the loop, so you can try a socket connect, an environment read, a write to the root filesystem, a memory allocation or a fork bomb and read the result of your own code.

The demo uses a CSV with an injected instruction that tells the agent to print its environment, read credentials and send them to an external URL. The video shows what the real model did with it and says so plainly if it refused. The same attacks also run directly against the sandbox with no model, along with a memory bomb, an infinite loop and an output flood.

Residual risks are in the README: plain Docker shares the host kernel, the backend user is in the docker group, and a hostile file can still mislead the model's text answer. Spend is capped per run and per hour. Business value is an argument, not a measurement: teams that want AI analysis of untrusted files, and security teams that need a checkable boundary around agents that run code, are the intended buyers. No customers, prices or market figures are claimed.
```

About 576 words, counted by hand per paragraph (54, 62, 80, 146, 87, 67, 80). The minimum is 100. Not true until checklist rows 2 to 8 are closed.

### Technology and category tags (form wording and options unverified)

Suggested, subject to what the form offers: Vultr Serverless Inference, Vultr Cloud Compute, kimi-k2-instruct (only once confirmed), Docker, AI agents, tool calling, sandboxing, Node.js, Caddy. Category or track: Challenge 1, Blast Radius Zero.

### Cover image (EVENT lists it as required; lablab recommends 16:9)

The operator avatar file named in CLAUDE.md. Alex uploads it himself. It is an avatar, not a screenshot of the product, and nothing in this repo presents it as one. Crop to 16:9 if the form does not.

### Video presentation (default: a link; under 300MB and 5 minutes; MP4 or MOV)

`[VIDEO_URL]`

Script: docs/demo-script.md. Recorded and uploaded by Alex, on the Vultr host with a real model.

### Slide presentation (default: PDF)

`[SLIDES_PDF_PATH]`, exported from docs/slides.md. Export command is at the top of that file.

### Public GitHub repository

https://github.com/alexvec/vultr-agent-rush (public, MIT licence). The README explains the Vultr services and the infrastructure, as the event page asks. Confirm it is still public before submitting.

### Demo application platform

Vultr Cloud Compute (VM), with Vultr Serverless Inference. Not the Vercel preview.

### Demo application URL

`[LIVE_VULTR_URL]`

### Team name (only if a form asks)

Windboy (https://lablab.ai/ai-hackathons/vultr-hackathon/windboy). Alex Veciana (alexvec) is the only member and the admin.

## Before pasting

1. Every `[...]` placeholder is replaced.
2. Each checklist row is closed, or the statement it covers is removed from the text.
3. The text matches what the recorded video shows.
4. The counts have been re-checked with `wc` after pasting.
