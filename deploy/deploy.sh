#!/usr/bin/env bash
# One command from a laptop to a fresh Ubuntu 24.04 Vultr VM:
#
#   VULTR_INFERENCE_API_KEY=... deploy/deploy.sh root@<vm-ip> [--domain example.com]
#
# It ships the committed tree (HEAD, not the working directory) and sends the key over
# ssh stdin, so the key is not on a command line or in the repo. Run it again to update.
#
# It labels the target as a Vultr VM (PADDED_CELL_DEPLOYMENT in /etc/padded-cell/env), and
# /healthz reports that as a label. Point it only at a Vultr VM.
#
# STATUS: this has never been run against a real Vultr VM. See the README.
set -euo pipefail

usage() { echo "usage: VULTR_INFERENCE_API_KEY=... $0 root@<vm-ip> [--domain name] [--dry-run]" >&2; exit 2; }

TARGET="${1:-}"; [ -n "$TARGET" ] || usage; shift
DOMAIN=""; DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; [ -n "$DOMAIN" ] || usage; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) usage ;;
  esac
done

if [ -z "${VULTR_INFERENCE_API_KEY:-}" ]; then
  echo "VULTR_INFERENCE_API_KEY is not set. Refusing to deploy: without it the VM would refuse every agent run, which does not meet Challenge 1." >&2
  exit 1
fi

HOST_IP="${TARGET#*@}"
if [ -z "$DOMAIN" ]; then
  if [[ "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # sslip.io maps <ip>.sslip.io to that IP, which lets Caddy get a real TLS certificate without a domain.
    DOMAIN="${HOST_IP}.sslip.io"
  else
    DOMAIN="$HOST_IP"
  fi
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- src web sandbox deploy package.json)" ]; then
  echo "warning: uncommitted changes exist in the app. They are not deployed, only HEAD ($COMMIT) is." >&2
fi

echo "target=$TARGET domain=$DOMAIN commit=$COMMIT"
if [ "$DRY_RUN" = 1 ]; then
  echo "dry run: nothing was sent."
  exit 0
fi

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$TARGET")

"${SSH[@]}" 'rm -rf /root/padded-cell-release && mkdir -p /root/padded-cell-release'
git -C "$REPO_ROOT" archive --format=tar HEAD src web sandbox samples deploy package.json package-lock.json \
  | "${SSH[@]}" 'tar -xf - -C /root/padded-cell-release'

# The key is the only line on stdin. provision.sh reads it and stores it with mode 0600.
printf '%s\n' "$VULTR_INFERENCE_API_KEY" \
  | "${SSH[@]}" "DOMAIN='$DOMAIN' COMMIT='$COMMIT' DEPLOYMENT='vultr-vm' bash /root/padded-cell-release/deploy/provision.sh"

echo
echo "Checking from this machine, outside the VM:"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --show-error --max-time 10 "https://$DOMAIN/healthz"; then
    echo
    echo "Live at https://$DOMAIN"
    echo "track stays not_met until one agent run has made a real chat completion. Run: npm run smoke:inference, then one agent run, then read /healthz again."
    exit 0
  fi
  echo "not ready yet (attempt $attempt)" >&2
  sleep 6
done
echo "The app did not answer at https://$DOMAIN/healthz. On the VM, run: journalctl -u padded-cell -u caddy" >&2
exit 1
