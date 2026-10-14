"""Audit hooks are permanent, so every test runs in a fresh Python process."""
import subprocess
import sys
import textwrap
from pathlib import Path

SRC = str(Path(__file__).parents[1] / "src")


def run(code, home, tmp_path):
    script = textwrap.dedent(f"""
        import os, socket, subprocess, sys
        sys.path.insert(0, {SRC!r})
        from dotstories_engine import sandbox
        sandbox.install({str(home)!r})
        def attempt(name, fn):
            try:
                fn(); print(name, "allowed")
            except PermissionError:
                print(name, "blocked")
    """) + textwrap.dedent(code)
    r = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=30, cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    return dict(line.rsplit(" ", 1) for line in r.stdout.strip().splitlines())


def test_writes_only_inside_home(tmp_path):
    # Temp folders are allowed, so "outside" must be somewhere else: next to this test.
    home = tmp_path / "home"
    outside = Path(__file__).parent / ".sandbox-probe.txt"
    victim = Path(__file__).parent / ".sandbox-victim.txt"
    victim.write_text("keep me")
    try:
        out = run(f"""
            attempt("home", lambda: open({str(home / "a.txt")!r}, "w").close())
            attempt("outside", lambda: open({str(outside)!r}, "w").close())
            attempt("outside-osopen", lambda: os.close(os.open({str(outside)!r}, os.O_WRONLY | os.O_CREAT)))
            attempt("read-outside", lambda: open({str(victim)!r}).close())
            attempt("delete-outside", lambda: os.remove({str(victim)!r}))
        """, home, tmp_path)
        assert out == {"home": "allowed", "outside": "blocked", "outside-osopen": "blocked",
                       "read-outside": "allowed", "delete-outside": "blocked"}
        assert not outside.exists()
        assert victim.read_text() == "keep me"
    finally:
        outside.unlink(missing_ok=True)
        victim.unlink(missing_ok=True)


def test_caches_are_moved_inside_home(tmp_path):
    home = tmp_path / "home"
    out = run("""
        print("inside", all(os.environ[v].startswith(os.path.realpath(%r)) for v in
              ["HF_HOME", "XDG_CACHE_HOME", "TORCH_HOME", "TRITON_CACHE_DIR"]))
    """ % str(home), home, tmp_path)
    assert out["inside"] == "True"


def test_no_network_and_no_processes_while_a_dot_runs(tmp_path):
    out = run("""
        def connect(host):
            s = socket.socket()
            s.settimeout(0.2)
            try:
                s.connect((host, 9))
            except PermissionError:
                raise
            except OSError:
                pass  # nothing listening: fine, the call itself was allowed
            finally:
                s.close()
        attempt("net-before", lambda: connect("10.255.255.1"))
        with sandbox.locked():
            attempt("net-during", lambda: connect("10.255.255.1"))
            attempt("loopback-during", lambda: connect("127.0.0.1"))
            attempt("spawn-during", lambda: subprocess.run([sys.executable, "-c", "pass"]))
        attempt("spawn-after", lambda: subprocess.run([sys.executable, "-c", "pass"]))
    """, tmp_path / "home", tmp_path)
    assert out == {"net-before": "allowed", "net-during": "blocked", "loopback-during": "allowed",
                   "spawn-during": "blocked", "spawn-after": "allowed"}
