"""Runs one untrusted script inside the sandbox and reports what it tried.

The reports are written to stderr as marked lines and labelled "self-reported"
in the ledger, because the code under test shares this process and can forge or
bypass them. The walls do not depend on this file. Docker enforces them.
"""
import builtins
import io
import json
import os
import runpy
import socket
import sys

MARK = "@@pc-audit@@ "
MAX_RECORDS = 200
_fd = os.dup(2)
_count = 0
_write = os.write
_dumps = json.dumps


def record(kind, target, outcome):
    global _count
    if _count >= MAX_RECORDS:
        return
    _count += 1
    line = MARK + _dumps({"kind": kind, "target": str(target)[:200], "outcome": str(outcome)[:120]}) + "\n"
    try:
        _write(_fd, line.encode("utf-8", "replace"))
    except OSError:
        pass


def _outcome(exc):
    return "blocked:" + type(exc).__name__ + ":" + str(getattr(exc, "errno", ""))


_connect = socket.socket.connect
_connect_ex = socket.socket.connect_ex
_getaddrinfo = socket.getaddrinfo


def connect(self, address):
    try:
        result = _connect(self, address)
    except OSError as exc:
        record("network.connect", address, _outcome(exc))
        raise
    record("network.connect", address, "succeeded")
    return result


def connect_ex(self, address):
    code = _connect_ex(self, address)
    record("network.connect", address, "succeeded" if code == 0 else "blocked:errno:%s" % code)
    return code


def is_ip_literal(host):
    for family in (socket.AF_INET, socket.AF_INET6):
        try:
            socket.inet_pton(family, host)
            return True
        except (OSError, TypeError):
            pass
    return False


def getaddrinfo(host, *args, **kwargs):
    # create_connection resolves IP literals too, which never touches the network.
    if is_ip_literal(host):
        return _getaddrinfo(host, *args, **kwargs)
    try:
        result = _getaddrinfo(host, *args, **kwargs)
    except OSError as exc:
        record("network.dns", host, _outcome(exc))
        raise
    record("network.dns", host, "succeeded")
    return result


socket.socket.connect = connect
socket.socket.connect_ex = connect_ex
socket.getaddrinfo = getaddrinfo

_open = builtins.open


def audited_open(file, mode="r", *args, **kwargs):
    writing = any(flag in mode for flag in "wax+")
    kind = "file.write" if writing else "file.read"
    try:
        handle = _open(file, mode, *args, **kwargs)
    except OSError as exc:
        record(kind, file, _outcome(exc))
        raise
    record(kind, file, "succeeded")
    return handle


builtins.open = audited_open
io.open = audited_open


def hook(event, args):
    if event in ("subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.fork"):
        record("process." + event, args[0] if args else "", "attempted")


sys.addaudithook(hook)
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
