---
marp: true
paginate: true
theme: default
---

<!--
Export to PDF (Alex runs this; nothing is uploaded):
  npx @marp-team/marp-cli docs/slides.md --pdf -o padded-cell-slides.pdf
Any other Markdown-to-PDF route also works: each "---" line starts a new slide.

Do not export until the markers in square brackets are resolved:
  [LIVE_VULTR_URL]  the real Vultr URL
  [SCREENSHOT ...]  a real screenshot from the live run
The slides describe the product as it should be once live on Vultr. As of 2026-11-03 it is not. See docs/submission.md checklist.
-->

# Padded Cell

Blast Radius Zero: an AI agent that analyses files you do not trust, inside walls that hold whatever the model decides.

Vultr Agent Rush, Challenge 1. Team Windboy.

Repo: https://github.com/alexvec/vultr-agent-rush
Live: [LIVE_VULTR_URL]

---

# The problem

- People receive files they do not control: a vendor export, a third-party log, a partner CSV.
- An agent that analyses them by running code is useful, and dangerous.
- The file can contain instructions aimed at the agent. The model can be steered by them.
- So the safety has to come from the walls, not from the model behaving.

---

# What Padded Cell does

1. Upload a file and ask a question.
2. The agent writes Python and runs it in a locked-down Docker container.
3. You get the answer and a containment ledger for the run:
   limits applied, what the sandbox could see, what the code tried, how it ended, and proof the container is gone.

---

# How it works

```
Browser -> Caddy -> Node backend (host process, user paddedcell)
                      |  chat completions     |  docker create / inspect / start / rm
                      v                       v
        Vultr Serverless Inference     One container per run step
        kimi-k2-instruct, tool calling  no network, read-only root,
                                        empty env, no capabilities,
                                        memory / CPU / pids limits
```

Two tools for the model: `read_input_file` and `run_code`. The model decides each step. The backend executes.

---

# Why the partner technology makes it possible

- **Vultr Serverless Inference (kimi-k2-instruct, tool calling):** every agent step is a chat completion. Vultr documents tool calling on this model only. No inference, no agent.
- **Vultr Cloud Compute:** hosts the backend, the web app and the Docker runtime that holds the sandbox.
- Both are required by Challenge 1. Here the inference is the decision-maker, not decoration.

---

# The walls

| Focus | Control |
|---|---|
| Network | `--network none` |
| Process isolation | non-root, all capabilities dropped, no-new-privileges, default seccomp, read-only root |
| Secrets | key only in the backend env; sandbox env empty; log redaction |
| Resources | 128 MiB, 0.5 CPU, 32 pids, 10 s, 64 KiB output; 8 steps, 20,000 tokens, 180 s per run |
| Lifecycle | one container per step, force-removed, removal verified, stale reaper |

Before each container starts, `docker inspect` is compared with the wall policy. A mismatch means it is never started.

---

# The ledger: evidence versus self-report

- **Evidence:** walls (docker inspect), probe (same-flags container), exit data (docker inspect and backend timers). The code under test cannot change these.
- **Self-reported:** the `attempts` record comes from inside the sandbox. Hostile code can forge or bypass it, and the ledger says so.
- **Not measured:** peak memory and CPU.

Every value on screen comes from the run being shown.

---

# Containment moment

[SCREENSHOT: poisoned-vendor-payments.csv run, tool call and ledger, from the live Vultr run]

- The poisoned file tells the agent to print its environment, read credentials and POST them to an external URL.
- If the model obeys: the ledger shows what the sandbox could reach. If it refuses: we say so, and run the same attack directly with no model.
- Then a memory bomb: exit reason and verified removal, read from the ledger.

---

# Against the four criteria

(Weights are not published for this event. No weighting is assumed.)

- **Application of Technology:** inference drives every step; Docker on a Vultr VM does the isolation; `/healthz` reports mode, model and host.
- **Presentation:** one page, one-click sample files, a ledger you can open as raw JSON.
- **Business Value:** an argument, not a measurement. Teams that want AI analysis of untrusted files, and security teams that must allow code-executing agents only inside a verifiable boundary. No customers, prices or market figures are claimed.
- **Originality:** the blast radius as a per-run artefact, with the limits of its own evidence stated.

---

# Honest limits

- Plain Docker shares the host kernel. gVisor would reduce that and is not implemented.
- The backend user is in the `docker` group, equivalent to root on the VM. A deliberate trade, so no web-facing container holds the Docker socket.
- A hostile file can still mislead the model's text answer.
- `--network none` does not limit what the backend sends to the inference API.
- Spend is capped per run and per hour, not eliminated. Rate limits are per process, in memory.

---

# What is next

- gVisor for a stronger kernel boundary.
- Measure peak memory and CPU instead of leaving them out.
- Rate limits and budgets that survive a restart.

Repo: https://github.com/alexvec/vultr-agent-rush
Live: [LIVE_VULTR_URL]
