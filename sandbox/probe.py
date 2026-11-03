"""Reports what a sandboxed process can actually see and do. Output: one JSON line."""
import json
import os
import socket
import sys
import threading


def attempt(fn):
    try:
        fn()
        return {"ok": True, "error": None}
    except OSError as exc:
        return {"ok": False, "error": type(exc).__name__ + ":" + os.strerror(exc.errno or 0)}


def connect(host, port):
    def inner():
        with socket.create_connection((host, port), timeout=1):
            pass
    return inner


def dns_lookup(host):
    # The resolver retries for seconds with no network, so this waits a bounded time.
    outcome = {"ok": False, "error": "no answer within 1.5s"}

    def worker():
        try:
            socket.getaddrinfo(host, 443)
            outcome.update(ok=True, error=None)
        except OSError as exc:
            outcome.update(ok=False, error=type(exc).__name__ + ":" + str(exc))

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(1.5)
    return dict(outcome)


def write(path):
    def inner():
        with open(path, "w") as handle:
            handle.write("x")
    return inner


def status():
    fields = {}
    with open("/proc/self/status") as handle:
        for line in handle:
            key, _, value = line.partition(":")
            if key in ("Uid", "CapEff", "CapBnd", "NoNewPrivs", "Seccomp"):
                fields[key] = value.strip()
    return fields


def interfaces_up():
    up = []
    for name in sorted(os.listdir("/sys/class/net")):
        try:
            with open("/sys/class/net/%s/flags" % name) as handle:
                if int(handle.read().strip(), 16) & 0x1:
                    up.append(name)
        except (OSError, ValueError):
            pass
    return up


def route_count():
    total = 0
    with open("/proc/net/route") as handle:
        total += max(len(handle.readlines()) - 1, 0)
    try:
        with open("/proc/net/ipv6_route") as handle:
            # Loopback entries are expected. Anything on another device is a route out.
            total += sum(1 for line in handle if line.split()[-1] != "lo")
    except OSError:
        pass
    return total


def pid1_environ_bytes():
    try:
        with open("/proc/1/environ", "rb") as handle:
            return len(handle.read())
    except OSError:
        return None


print(json.dumps({
    "env_names": sorted(os.environ.keys()),
    "pid1_environ_bytes": pid1_environ_bytes(),
    "interfaces_up": interfaces_up(),
    "route_count": route_count(),
    "tcp_metadata_ip": attempt(connect("169.254.169.254", 80)),
    "tcp_public_ip": attempt(connect("1.1.1.1", 443)),
    "dns_lookup": dns_lookup("example.com"),
    "write_root": attempt(write("/pc-probe")),
    "write_input": attempt(write("/input/pc-probe")),
    "write_scratch": attempt(write("/tmp/pc-probe")),
    "docker_socket_present": os.path.exists("/var/run/docker.sock") or os.path.exists("/run/docker.sock"),
    "status": status(),
}))
sys.stdout.flush()
os._exit(0)
