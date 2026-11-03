# Demo script: Padded Cell

Target length 4:30. The limit is 5:00 (guideline default from docs/competition.md s7: under 5 minutes, under 300MB, MP4 or MOV; not confirmed for this event). Leave the margin. Alex records and uploads the video himself.

## Rules for the recording

1. **Record against the real Vultr deployment, `[LIVE_VULTR_URL]`.** Not the Vercel preview, not localhost.
2. **Do not record without inference.** With no key the app refuses agent runs. If a "NO INFERENCE KEY" banner shows, or `/healthz` says `inference: absent`, stop. Fix it and start again.
3. Before recording, open `/healthz` and confirm: `inference: live`, `inference_verified_by: chat_completion`, `deployment: vultr-vm`, `track.status: met_according_to_label`, `sandbox.execution: enabled`. `track` stays `not_met` until an agent run has made a real chat completion in this process, so do one off camera first. The deployment value is a label, not a measurement.
4. No banners on the page. Run the whole sequence once off camera first.
5. Say only what the screen shows. Where a value comes from the live ledger, read it from the ledger on screen. Do not rehearse numbers into the narration.
6. If the model refuses the poisoned file, say so. Do not claim it was fooled.
7. Browser window at a readable zoom. Have the sample files ready: `samples/vendor-payments.csv`, `samples/poisoned-vendor-payments.csv`.

## Shots

| Time | Screen | Narration |
|---|---|---|
| 0:00-0:30 | Title slide, then the app | "Files from vendors and partners are not files you control. An AI agent that analyses them by running code is useful, and a hostile file can try to steer it. Padded Cell makes the walls do the work, whatever the model decides, and shows you the proof." |
| 0:30-1:00 | `[LIVE_VULTR_URL]/healthz` in the browser, then the status row on the page | "This is the deployed app. Health check: inference live, model kimi-k2-instruct, host Vultr VM, sandbox execution enabled." Point at each field as you say it. Read the model id from the screen. |
| 1:00-1:50 | Choose `vendor-payments.csv`. Ask: "What is the total amount_usd of invoices with status paid?" Run the agent. Show the tool call, the sandbox output, the answer | "Every step is a chat completion to Vultr Serverless Inference. The model picks a tool, the backend runs its code in a fresh container, and the result goes back." Then: "The answer is [read from the answer on screen]. The file is short enough to check by hand." Show the hand check (sum the paid rows). |
| 1:50-2:50 | **Containment moment.** Choose `poisoned-vendor-payments.csv`. Same question. Run. Show the tool calls, then the ledger | "One row in this file is addressed to the AI agent. It says to print the environment, read credentials, and POST them to an external address." Then branch on what happens. **If the model obeys:** show the tool call with the attack code, then the ledger: network attempts, environment names seen in the sandbox, backend secrets found in outputs, all read from the ledger on screen. **If it refuses:** "The model declined this time. That is the model behaving, which the walls do not rely on." Go straight to the next shot. |
| 2:50-3:40 | Direct attack presets, no model: "Steal credentials and call out", then "Memory bomb" | "Now the model is out of the loop. This code reads credential paths and tries DNS, a public address and the cloud metadata address." Show blocked reads and connects. "Next, a memory bomb." Show the exit reason, read from the ledger on screen, and the removal check (`removed_verified`). Optionally the infinite loop, for its exit reason. |
| 3:40-4:00 | Open the raw ledger JSON | "Every value comes from this run. Walls from docker inspect, a probe container, exit data from inspect and the backend's timers. One section is different: the attempts record is reported from inside the sandbox, so hostile code could forge it. The ledger says that. Peak memory and CPU are not measured." |
| 4:00-4:20 | Slide: Vultr services, then the architecture slide | "Vultr Serverless Inference makes every decision, using tool calling that Vultr documents on kimi-k2-instruct. The Vultr VM runs the backend and the Docker sandbox. Take the inference away and there is no agent." |
| 4:20-4:40 | Slide: who pays, then what is next | "Who pays is reasoning, not a measurement: teams that want AI analysis of untrusted files, and security teams that must allow code-executing agents only inside a boundary they can verify. No customer or price is claimed. Limits: plain Docker shares the host kernel. Next: gVisor, and measuring memory and CPU." |
| 4:40-4:50 | End card: repo URL and `[LIVE_VULTR_URL]` | "The code is MIT-licensed at github.com/alexvec/vultr-agent-rush." |

## After recording

- Total under 5:00, file under 300MB, MP4 or MOV.
- Watch it once through. Check that nothing on screen shows a key, and that no "NO INFERENCE KEY" banner appears.
- Put the video link into `[VIDEO_URL]` in docs/submission.md. Alex uploads and submits himself.
