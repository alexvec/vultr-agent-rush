# Demo script: Padded Cell

Target length 4:40. The limit is 5:00 (lablab default from docs/competition.md s7: under 5 minutes, under 300MB, MP4 or MOV; not confirmed for this event, check the form). Leave the margin. Alex records and uploads the video himself.

**This script cannot be recorded today.** There is no Vultr VM, no inference key and no live URL. The agent has only met a local stub. Do not record a substitute: not the Vercel preview, not localhost, not a keyless run. See the checklist in docs/submission.md.

## Rules for the recording

1. **Record on the Vultr deployment, `[LIVE_VULTR_URL]`, with a real model.** Not the Vercel preview, not localhost.
2. **Do not record without inference.** With no key the app refuses agent runs (503 `inference_not_configured`). If a "NO INFERENCE KEY" banner shows or `/healthz` says `inference: absent`, stop and fix it.
3. Before recording, open `/healthz` and confirm these real fields: `inference: live`, `inference_verified_by: chat_completion`, `model`, `planner: llm`, `deployment: vultr-vm`, `host`, `sandbox.execution: enabled`, `track.status: met_according_to_label`. `inference_verified_by` and `track` need one real agent run in this process first, so do one off camera. They reset on restart. `deployment` is a label the deploy script writes; `deployment_basis` in the same response says so. If `track.status` shows `not_met`, read its `reasons` and stop.
4. Stage a terminal in advance with the sample files, `jq` and `whois`, so the checks take seconds. No banners on the page. Run the whole sequence once off camera.
5. Say only what the screen shows. Read every number from the screen. Do not rehearse numbers into the narration.
6. If the model refuses the poisoned file, say so. Do not claim it was fooled.
7. The containment moment is judged from the record's outside-container section, `containers[].measured_outside_the_container`, and `containment_claims`. Do not use `self_reported_by_code_in_sandbox` as evidence on camera. It is labelled self-reported and can be forged by the code under test.
8. Say "label" when reading `deployment`. Say "weak evidence" when showing the canary.
9. Have ready: `samples/vendor-payments.csv`, `samples/poisoned-vendor-payments.csv`. Browser zoom readable. No key visible anywhere.

## Shots

| Time | Screen | Narration |
|---|---|---|
| 0:00-0:25 | Title slide, then the app | "Files from vendors and partners are not files you control. An agent that analyses them by running code is useful, and a hostile file can try to steer it. So the walls have to hold whatever the model decides, and whoever approves the agent needs something to check." |
| 0:25-1:05 | `[LIVE_VULTR_URL]/healthz`, then a terminal with `whois` or an ASN lookup of the host | Point at each field as you say it: "Inference live, verified by a chat completion. Model [read from screen]. Sandbox execution enabled. Deployment is a label the deploy script writes, so here is the check that does not depend on us: the network owner of this address is [read from the lookup]." |
| 1:05-1:50 | Choose `vendor-payments.csv`. Ask: "What is the total amount_usd of invoices with status paid?" Run the agent. Show the tool call, the sandbox output, the answer | "Every step is a chat completion to Vultr Serverless Inference. The model picks a tool, the backend runs its code in a fresh container, and the result goes back. The answer is [read from screen]. The file is short enough to check by hand." Sum the paid rows on screen. |
| 1:50-2:20 | Download the run record. In the terminal: `sha256sum samples/vendor-payments.csv`, then `jq -r .input.sha256`, then `jq -r .output.base64 record.json \| base64 -d \| sha256sum` against `jq -r .output.sha256` | "The record carries the hash of the file I uploaded and of the program's output. They match what I compute here. The record is not signed, so this ties it to files I hold. It does not prove the server told the truth." |
| 2:20-3:20 | **Containment moment.** Choose `poisoned-vendor-payments.csv`. Same question. Run. Show the tool calls. Then open the record and scroll to `containers[].measured_outside_the_container` | "One row in this file is addressed to the AI agent. It says to print the environment, read credentials and send them out." Branch on what the model did. **Obeyed:** show the tool call with the attack code. **Refused:** "The model declined. That is the model behaving, and the walls do not rely on it." Either way show, from the record: `inspect_before_start_raw.HostConfig.NetworkMode` is `none`, the wall checks all `ok`, `final_state_raw`, the `destroy` event, and `post_removal_inspect` failing with "No such container". Show `containment_claims` and the canary: "Zero hits on one address is weak evidence, and the record says so." |
| 3:20-4:00 | Direct mode, no model. Type code on screen: a socket connect to a public address, an environment read, a write to `/`. Then the "Memory bomb" preset | "Now the model is out of the loop, and this is code I wrote. Result: [read from screen]." Then: "A memory bomb. Exit reason [read `exit_reason`], and `OOMKilled` in the final container state, read from the record. The container is gone: inspect fails." |
| 4:00-4:20 | Slide: why Vultr, then the architecture slide | "Vultr Serverless Inference makes every decision, using tool calling that Vultr documents on kimi-k2-instruct. The Vultr VM runs the backend and the Docker sandbox. Take the inference away and there is no agent." |
| 4:20-4:40 | Slide: who pays and limits, then what is next, then end card with repo URL and `[LIVE_VULTR_URL]` | "Who pays is reasoning, not a measurement: teams that want AI analysis of untrusted files, and security teams that must see a checkable boundary. No customer or price is claimed. Limits: plain Docker shares the host kernel, and the record is not signed. Next: gVisor, and measuring memory and CPU. The code is MIT-licensed at github.com/alexvec/vultr-agent-rush." |

## After recording

- Total under 5:00, file under 300MB, MP4 or MOV.
- Watch it once through. Check that no key shows, no "NO INFERENCE KEY" banner appears, and nothing was typed in by hand as if it were output.
- Put the link into `[VIDEO_URL]` in docs/submission.md. Alex uploads and submits.
