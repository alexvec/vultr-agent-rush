#!/usr/bin/env bash
# Runs on the VM as root, called by deploy.sh. Safe to run again.
# Reads the inference key from stdin. Needs DOMAIN, COMMIT and DEPLOYMENT in the environment.
#
# STATUS: this has never been run against a real Vultr VM. See the README.
set -euo pipefail

: "${DOMAIN:?DOMAIN is required}"
: "${COMMIT:?COMMIT is required}"
: "${DEPLOYMENT:?DEPLOYMENT is required}"
IFS= read -r INFERENCE_KEY
[ -n "$INFERENCE_KEY" ] || { echo "no inference key on stdin" >&2; exit 1; }

RELEASE=/root/padded-cell-release
APP_DIR=/opt/padded-cell
ENV_DIR=/etc/padded-cell
CANARY_PORT=9099
APP_USER=paddedcell
export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io
fi

if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /usr/share/keyrings/caddy-stable-archive-keyring.asc
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.asc] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# Checked at this exact path because that is the one the systemd unit runs.
if [ ! -x /usr/local/bin/node ] || [ "$(/usr/local/bin/node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  ARCH="$(dpkg --print-architecture)"; [ "$ARCH" = "amd64" ] && NODE_ARCH=x64 || NODE_ARCH=arm64
  NODE_VERSION=22.11.0
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o /tmp/node.sha
  (cd /tmp && grep " node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz\$" node.sha | sed "s#node-v.*#node.tar.xz#" | sha256sum -c -)
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.xz /tmp/node.sha
fi

echo "== host hardening"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Password login is turned off only if a key is already installed, so this cannot lock Alex out.
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/10-padded-cell.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSHD
  systemctl reload ssh || systemctl reload sshd || true
fi
systemctl enable --now fail2ban
systemctl enable --now unattended-upgrades

cat > /etc/sysctl.d/90-padded-cell.conf <<'SYSCTL'
kernel.unprivileged_bpf_disabled = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
SYSCTL
sysctl --system >/dev/null

mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKERD'
{
  "icc": false,
  "live-restore": true,
  "no-new-privileges": true,
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
DOCKERD
systemctl restart docker

# The canary listens only on the Docker bridge address, so it is not reachable from the internet.
# ufw would drop bridge-to-host traffic, and then a failed wall could never show up as a hit.
# This adds no route to any sandbox container: they run with --network none.
CANARY_BIND="$(ip -4 -o addr show docker0 | awk '{print $4}' | cut -d/ -f1 | head -n 1)"
if [ -n "$CANARY_BIND" ]; then
  ufw allow in on docker0 to "$CANARY_BIND" port "$CANARY_PORT" proto tcp
else
  # Do not fail the deploy over weak evidence. Loopback stays private, but containers could not reach it.
  echo "warning: no docker0 address, so the canary binds to loopback, where a failed wall could not hit it" >&2
  CANARY_BIND=127.0.0.1
fi

echo "== service user"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir /var/lib/padded-cell --shell /usr/sbin/nologin "$APP_USER"
# Being in the docker group is root-equivalent. This is a stated residual risk in the README.
# The alternative is a container holding the docker socket, which the track design rejects.
usermod -aG docker "$APP_USER"

echo "== app"
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR/src" "$APP_DIR/web" "$APP_DIR/samples" "$APP_DIR/sandbox"
cp -R "$RELEASE/src" "$RELEASE/web" "$RELEASE/samples" "$RELEASE/sandbox" "$RELEASE/package.json" "$APP_DIR/"
chown -R root:root "$APP_DIR"
chmod -R a+rX "$APP_DIR"
docker build -q -t padded-cell-sandbox:latest "$APP_DIR/sandbox" >/dev/null
mkdir -p /var/lib/padded-cell/runs
chown -R "$APP_USER:$APP_USER" /var/lib/padded-cell
chmod 0755 /var/lib/padded-cell /var/lib/padded-cell/runs

echo "== secrets"
install -d -m 0750 -o root -g "$APP_USER" "$ENV_DIR"
umask 077
cat > "$ENV_DIR/env" <<ENVFILE
VULTR_INFERENCE_API_KEY=$INFERENCE_KEY
VULTR_INFERENCE_MODEL=${VULTR_INFERENCE_MODEL:-deepseek-v4.1-flash-1017}
PADDED_CELL_DEPLOYMENT=$DEPLOYMENT
PADDED_CELL_HOST=$DOMAIN
PADDED_CELL_CANARY_BIND=$CANARY_BIND
PADDED_CELL_CANARY_PORT=$CANARY_PORT
PADDED_CELL_CANARY_TARGET_HOST=$CANARY_BIND
PADDED_CELL_TRUST_PROXY=1
PADDED_CELL_WORK_DIR=/var/lib/padded-cell/runs
PADDED_CELL_COMMIT=$COMMIT
HOST=127.0.0.1
PORT=8080
ENVFILE
chown root:"$APP_USER" "$ENV_DIR/env"
chmod 0640 "$ENV_DIR/env"
umask 022
unset INFERENCE_KEY

echo "== services"
install -m 0644 "$RELEASE/deploy/padded-cell.service" /etc/systemd/system/padded-cell.service
sed "s/__DOMAIN__/$DOMAIN/" "$RELEASE/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable padded-cell caddy
systemctl restart padded-cell
systemctl reload caddy || systemctl restart caddy

echo "== local checks on the VM"
sleep 2
systemctl is-active padded-cell caddy
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
echo
if grep -rIl --exclude-dir=node_modules docker.sock /etc/systemd/system/padded-cell.service >/dev/null 2>&1; then
  echo "unexpected docker.sock reference in the service unit" >&2
  exit 1
fi
rm -rf "$RELEASE"
echo "provisioned commit $COMMIT"
