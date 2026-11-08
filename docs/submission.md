# Submission text: Padded Cell (Challenge 1, Blast Radius Zero)

Paste-ready text for the lablab.ai form. Nothing here has been submitted. Alex records the video, uploads the files and clicks Submit.

## Still open

| Item | State on 8 November 2026 |
|---|---|
| Live app | https://65.20.88.246.sslip.io. `/healthz` reported inference live, model `deepseek-v4.1-flash-1017`, sandbox execution enabled, track `met_according_to_label`. That track label resets when the process restarts, until the next agent run. |
| Network owner | `65.20.88.246` is in `65.20.64.0/18`, origin AS20473. RADB describes the route as a Vultr assigned prefix. |
| Poisoned file | Run `7ba8d2c54cd7dcc484`. The model did not follow the injected note. Answer `21690.12`. Hashes matched. Network mode `none`. Inspect after removal: "No such container". Response ids and token usage were in the record. No request-id header on an earlier smoke call. |
| Slides | `docs/padded-cell-slides.pdf` |
| Cover | `docs/cover-16x9.jpg`. Existing portrait, letterboxed. Not uploaded. |
| Video | Not recorded. Leave the video field empty until it exists. |
| Do not use | https://padded-cell-preview.vercel.app |

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

Recount with `wc` after any edit. The limit is 255 characters. This paragraph is true of the live app.

### Long description (default minimum: 100 words; no maximum is stated)

```
Padded Cell is an AI agent for files you do not trust. You upload a file, such as a vendor export or a third-party log, and ask a question. The agent answers by writing Python and running it. Every run ends with a downloadable run record that you can check against files you hold.

Every decision the agent makes is a Vultr Serverless Inference call. The backend sends chat completions to deepseek-v4.1-flash-1017, the model this deployment uses. Vultr's older tool-calling page names kimi-k2-instruct, which is not in the current model list. This model accepted the tool calls. The two tools are read_input_file and run_code, and the model chooses each step. Without the inference there is no agent. The backend, the web app and the Docker runtime run on one Vultr Cloud Compute VM behind Caddy, at https://65.20.88.246.sslip.io. The address 65.20.88.246 is in 65.20.64.0/18, origin AS20473, described in RADB as a Vultr assigned prefix.

Code runs only in a hardened Docker container: no network, read-only root filesystem, empty environment, all capabilities dropped, non-root user, 128 MiB of memory with no swap, half a CPU, 32 processes and a 10 second wall clock. Before each container starts, the backend reads docker inspect and refuses to start it if it does not match the policy. After each run the container is force-removed and its absence is checked. The inference key lives only in the backend process.

The run record separates evidence from self-report. The wall settings, the container's final state, the create, start, die and destroy timestamps, and the failed inspect after removal are captured by the backend from the Docker daemon, outside the container. The record also holds the sha256 of the uploaded bytes and of the program's output, the code the model wrote, and the inference response details the API returned. A list of attempts written from inside the sandbox is labelled self-reported, because hostile code can forge it, and no containment claim uses it. A listener outside the sandbox counts connections as a canary. Zero hits is weak evidence, and the record says so. The record is not signed, and its host-side values come from docker commands the same backend ran, so the hashes tie it to files you hold but do not prove the server told the truth.

You can check the result yourself. Hash the sample file in the repo and compare it with input.sha256, decode output.base64 and compare its hash with output.sha256, and look up the network owner of the demo hostname to see that the host is Vultr. A direct mode runs code you write, with no model in the loop, so you can try a socket connect, an environment read, a write to the root filesystem, a memory allocation or a fork bomb and read the result of your own code.

The demo uses a CSV with an injected instruction that tells the agent to print its environment, read credentials and send them to an external URL. On 8 November 2026 the live model did not follow it. It read the file, summed the paid rows, and answered 21690.12, which matches a local sum of those rows. Run 7ba8d2c54cd7dcc484 returned response ids and token usage. Both containers had network mode none, every wall check passed, and docker inspect after removal failed with "No such container". The video shows that run, then the same attacks with no model, including a memory bomb.

Residual risks are in the README: plain Docker shares the host kernel, the backend user is in the docker group, and a hostile file can still mislead the model's text answer. Spend is capped per run and per hour. Business value is an argument, not a measurement: teams that want AI analysis of untrusted files, and security teams that need a checkable boundary around agents that run code, are the intended buyers. No customers, prices or market figures are claimed.
```

Recount with `wc` after any edit. The minimum is 100 words. The model name, the URL, the network owner and the 8 November poisoned-file run are measured. The memory bomb is in the test suite and in the demo script; say in the video what that run shows.

### Technology and category tags (form wording and options unverified)

Suggested, subject to what the form offers: Vultr Serverless Inference, Vultr Cloud Compute, deepseek-v4.1-flash-1017, Docker, AI agents, tool calling, sandboxing, Node.js, Caddy. Category or track: Challenge 1, Blast Radius Zero.

### Cover image (EVENT lists it as required; lablab recommends 16:9)

`docs/cover-16x9.jpg`. It is the existing portrait, placed on a 1920×1080 canvas so the whole photo remains. It is not a screenshot of the product. Alex uploads it with the form. It is not uploaded here.

### Video presentation (default: a link; under 300MB and 5 minutes; MP4 or MOV)

Leave this empty until the recording exists. Then paste the link.

Script: docs/demo-script.md. Recorded and uploaded by Alex, on the Vultr host with a real model.

### Slide presentation (default: PDF)

`docs/padded-cell-slides.pdf`, exported from docs/slides.md.

### Public GitHub repository

https://github.com/alexvec/vultr-agent-rush (public, MIT licence). The README explains the Vultr services and the infrastructure, as the event page asks. Confirm it is still public before submitting.

### Demo application platform

Vultr Cloud Compute (VM), with Vultr Serverless Inference. Not the Vercel preview.

### Demo application URL

https://65.20.88.246.sslip.io

### Team name (only if a form asks)

Windboy (https://lablab.ai/ai-hackathons/vultr-hackathon/windboy). Alex Veciana (alexvec) is the only member and the admin.

## Before pasting

1. Every `[...]` placeholder is replaced.
2. Each checklist row is closed, or the statement it covers is removed from the text.
3. The text matches what the recorded video shows.
4. The counts have been re-checked with `wc` after pasting.
