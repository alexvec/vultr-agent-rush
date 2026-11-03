# Submission text: Padded Cell (Challenge 1, Blast Radius Zero)

Paste-ready text for the lablab.ai form. It is written as it should read once the app is live on Vultr. **Several statements below are not true today.** Do not submit until the checklist is cleared. Nothing here has been submitted, uploaded or posted. Alex runs submit.sh himself.

## PRE-SUBMIT CHECKLIST (read first)

State on 2026-11-03: the only running deployment is the labelled Vercel preview, https://padded-cell-preview.vercel.app. It has code execution disabled and no inference key. It is not on Vultr, does not satisfy Challenge 1, and must not be entered as the demo URL.

| # | Statement in the text below that is not yet true | What must happen first |
|---|---|---|
| 1 | "Every decision the agent makes is a Vultr Serverless Inference call" (long description, slides, video) | A Vultr account, the $200 credit applied, and a Serverless Inference key exist (NEEDS 4, 5, 7). Then run `node --env-file=.env scripts/smoke-inference.js` and confirm the real model id, response schema and tool-call round trip. The client has only ever met a local stub. If the real API differs, fix the client and update the text |
| 2 | "runs on a Vultr Cloud Compute VM" (long description), "in a locked-down Docker sandbox on Vultr" (short description) and the demo URL | Provision an Ubuntu 24.04 VM, run `VULTR_INFERENCE_API_KEY=... deploy/deploy.sh root@<vm-ip>`. The deploy scripts have been syntax-checked and linted only, never run. Expect to fix something |
| 3 | Live URL works | From another network, `/healthz` must report `inference: live`, `inference_verified_by: chat_completion`, `deployment: vultr-vm`, `track.status: met_according_to_label`, `sandbox.execution: enabled`. The deployment value is a label, so also check the network owner of the hostname. Then replace `[LIVE_VULTR_URL]` everywhere, and set `url:` in STATE.md |
| 4 | "The repo includes tests that run hostile code directly against the sandbox" is true, but do not say they pass | See README.md, Current status, for the last measured local result. That run uses a local stub for the model and has never run on Vultr. Re-run `npm test` and `npm run demo` on the Vultr VM before saying anything about the deployed app |
| 5 | The demo walkthrough (long description, video) | Record the video on the Vultr host in LLM mode, never from a server without an inference key: the app now refuses agent runs there. Follow docs/demo-script.md. Replace `[VIDEO_URL]` |
| 6 | "If the model obeys / if it refuses" wording | Check what the real model did with the poisoned file and make the video and any slide screenshot say exactly that. Do not claim it was fooled if it was not |
| 7 | Slides PDF and cover image | Export docs/slides.md to PDF. Add real screenshots from the live run where the slides carry `[SCREENSHOT ...]` markers. Upload the cover image yourself |
| 8 | Inference spend limit "30 model-driven runs per hour" | Coverage of Serverless Inference by the $200 credit is unverified (NEEDS 8). Check the Usage tab |
| 9 | Event logistics | Deadline is unverified (docs/competition.md s1). Check the event page and Discord. Confirm Discord is connected if the form needs it (NEEDS 2). Confirm the repo is still public and MIT-licensed |

Character and word limits below are generic guideline defaults (docs/competition.md s7, source GUIDE). The event page lists no limits. They are not confirmed for this event. Check the live form and adjust if it shows different limits.

## Form fields (docs/competition.md s7)

### Project title (guideline default: max 50 characters)

```
Padded Cell: Blast Radius Zero for AI Agents
```

Count: 44 characters (hand-counted). "Padded Cell" is a working title, not a registered name.

### Short description (guideline default: up to 255 characters)

```
Padded Cell lets an AI agent analyse an untrusted file by writing and running code in a locked-down Docker sandbox on Vultr. Every run returns a containment ledger: limits, what the sandbox could see, how it ended, and proof the container is gone.
```

Count: 247 characters (hand-counted). Verify before pasting: `pbpaste | wc -m`.

### Long description (guideline default: at least 100 words)

```
Padded Cell is an AI agent for files you do not trust. You upload a file, such as a vendor export or a third-party log, and ask a question. The agent answers by writing Python and running it, and every run ends with a containment ledger that shows what the walls were and how the run finished.

Every decision the agent makes is a Vultr Serverless Inference call. The backend sends chat completions to kimi-k2-instruct with two tools, read_input_file and run_code, and the model chooses what to do next. Remove the inference and there is no agent. The backend, the web app and the Docker runtime run on a Vultr Cloud Compute VM behind Caddy.

Code never runs outside a hardened Docker container: no network, read-only root filesystem, empty environment, all capabilities dropped, non-root user, 128 MiB of memory with no swap, half a CPU, 32 processes and a 10 second wall clock. Before each container starts, the backend reads docker inspect and refuses to start it if it does not match the policy. After each run the container is force-removed and its absence is checked. The inference key lives only in the backend process.

The ledger separates evidence from self-report. The walls, the probe and the exit data come from docker inspect, a probe container and the backend's own timers, so the code under test cannot change them. The record of attempts comes from inside the sandbox and can be forged by hostile code, and the ledger says so. Peak memory and CPU are not measured.

The demo uses a CSV with an injected instruction telling the agent to print its environment, read credentials and POST them to an external URL. The video shows what the real model did with it, and says so honestly if it refused. The same attacks also run directly against the sandbox with no model involved, along with a memory bomb, an infinite loop, a fork bomb and an output flood. The repo includes tests that run hostile code straight at the sandbox.

Residual risks are written in the README: plain Docker shares the host kernel, the backend's user is in the docker group, and a hostile file can still mislead the model's text answer. Inference spend is capped per run and per hour. Business value here is an argument, not a measurement: teams that want AI analysis of untrusted files, and security teams that need a verifiable boundary around agents that execute code, are the intended buyers. No customers, prices or market figures are claimed.
```

Count: about 400 words (hand-counted estimate; the minimum is 100). Verify: `pbpaste | wc -w`.

### Technology and category tags (form wording and options unverified)

Suggested, subject to what the form offers: Vultr Serverless Inference, Vultr Cloud Compute, kimi-k2-instruct, Docker, AI agents, tool calling, sandboxing, Node.js, Caddy. Category or track: Challenge 1, Blast Radius Zero.

### Cover image (the EVENT page lists it as required; GUIDE recommends 16:9, RULES says it is cropped to 16:9)

Use the operator avatar file (path per CLAUDE.md). Alex uploads it himself. It is an avatar, not a screenshot of the product, and nothing in this repo presents it as one. Crop to 16:9 if the form does not do it.

### Video presentation (guideline default: link; under 300MB and 5 minutes; MP4 or MOV)

`[VIDEO_URL]`

Script: docs/demo-script.md. Recorded by Alex, uploaded by Alex.

### Slide presentation (guideline default: PDF)

Export of docs/slides.md. File to upload: `[SLIDES_PDF_PATH]`. Export instructions are at the top of docs/slides.md.

### Public GitHub repository

https://github.com/alexvec/vultr-agent-rush (public, MIT licence). The README explains the Vultr services used and the infrastructure, as the EVENT page asks.

### Demo application platform

Vultr Cloud Compute (VM), with Vultr Serverless Inference. Not the Vercel preview.

### Demo application URL

`[LIVE_VULTR_URL]`

### Team name (only if a form asks)

Windboy (team page: https://lablab.ai/ai-hackathons/vultr-hackathon/windboy). Alex Veciana (alexvec) is the only member and the admin.

## Before pasting

1. Every `[...]` placeholder above is replaced.
2. Each row of the checklist is closed, or the statement it covers is removed from the text.
3. The text matches what the recorded video shows.
