# Evidence

`local-direct-run.json` is the run record for one direct-mode run, downloaded unchanged from `GET /api/runs/<id>/record`.

**This was a local run on a Mac, through Docker Desktop. It was not on Vultr, and no model was involved.** The server had no inference key, no Vultr service was called, and the server was reachable only on 127.0.0.1. The record says `deployment: local`, `planner: none`, `inference: not used` and `track.status: not_met`. It does not show that Challenge 1 is met, and it must not be presented as the demo.

## What was run

Commit `38b5008`, on 2026-11-03. Hostile Python was sent to `POST /api/runs/direct` with `samples/poisoned-vendor-payments.csv` as the input. The code printed its environment, tried to read credential paths and the Docker socket, tried socket connects to the canary target, 1.1.1.1:443 and 169.254.169.254:80, and tried to write to `/`, `/etc`, `/usr/bin` and `/input/data`.

## What it shows

Measured from outside the container, by the backend:

- Both containers, the probe and the hostile code, had network mode `none`, a read-only root, all capabilities dropped and user 65534:65534 in `docker inspect` before start. All 20 wall checks passed on each.
- Each container has create, start, die and destroy timestamps from `docker events`, and exited with code 0.
- After removal, `docker inspect` failed on each with "No such container".
- `input.sha256` equals `sha256sum samples/poisoned-vendor-payments.csv`, and `output.sha256` equals the hash of the decoded `output.base64`.

Printed by the code under test, in `output`, so read it as that code's own account: an empty environment, every connect failing and every write failing with "Read-only file system".

## What it does not show

- **The canary is weak evidence, and weaker still in this run.** It counted 0 hits. But the target was the name `host.docker.internal`, and the lookup failed before any connect was attempted. That is what no network looks like, but the zero says little by itself. The control test in `test/sandbox-walls.test.js` is what shows the listener does count a bridge container.
- Two of the three read attempts failed because the file does not exist in the image, not because a wall stopped them. `/root/.aws/credentials` failed with "Permission denied".
- The secret scan checked one value, the backend's canary secret, because this server had no inference key to check.
- The `attempts` list is self-reported by code in the sandbox. No claim uses it.
- The record is not signed. Docker Desktop runs containers in its own Linux VM, so a Vultr VM may behave differently.

## Scrubbed

The backend replaces the scratch directory prefix with `<work-dir>` and the home directory with `<home>`. The file was then searched for the local user name, home and temp paths, keys and the canary secret. None were found.

To check it:

```sh
sha256sum samples/poisoned-vendor-payments.csv
jq -r .input.sha256 docs/evidence/local-direct-run.json
jq -r .output.base64 docs/evidence/local-direct-run.json | base64 -d | sha256sum
jq -r .output.sha256 docs/evidence/local-direct-run.json
```
