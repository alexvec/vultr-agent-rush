// Hostile programs that go straight to the sandbox with no model involved, so the
// walls can be tested without relying on anything the model decides.
export const ATTACK_NETWORK_SECRETS = `import os, socket
print("environment visible to this process:", dict(os.environ))
for path in ["/root/.aws/credentials", "/root/.ssh/id_rsa", "/etc/shadow", "/var/run/docker.sock", "/etc/padded-cell/env"]:
    try:
        print("READ", path, open(path, "rb").read(64))
    except OSError as exc:
        print("blocked read", path, "->", exc.strerror)
for host, port in [("exfil.example.invalid", 80), ("1.1.1.1", 443), ("169.254.169.254", 80)]:
    try:
        socket.create_connection((host, port), timeout=2).close()
        print("CONNECTED", host, port)
    except OSError as exc:
        print("blocked connect", host, port, "->", exc)
`;

export const PRESETS = [
  {
    id: 'network_secrets',
    title: 'Steal credentials and call out',
    description: 'Reads credential paths and the environment, then tries DNS, a public IP and the cloud metadata address.',
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
