"""Engine sandbox (layer 1 of 2; the OS sandbox comes with the Tauri app).

Once installed it cannot be turned off (Python audit hooks are permanent):
- files: writes only inside the allowed folders (DOTSTORIES_HOME + temp)
- while a dot runs (`locked`): no network except 127.0.0.1, no new processes

Model files are loaded as safetensors only (see krea.py): pickle files can run code.
"""
import contextlib
import os
import sys
import tempfile
import threading

WRITE_FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND | os.O_TRUNC
LOOPBACK = {"127.0.0.1", "::1", "localhost"}
SPAWN = {"subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn", "os.startfile", "os.fork"}
CHANGE = {"os.remove", "os.rmdir", "os.mkdir", "shutil.rmtree", "os.truncate", "os.chmod"}


class SandboxError(PermissionError):
    pass


class Sandbox:
    def __init__(self, allowed_dirs):
        self.allowed = [os.path.realpath(d) for d in allowed_dirs]
        self._locked = threading.Event()

    def allows(self, path) -> bool:
        if isinstance(path, int):  # already-open file descriptor
            return True
        p = os.path.realpath(os.fsdecode(path))
        return p == os.devnull or any(p == d or p.startswith(d + os.sep) for d in self.allowed)

    @contextlib.contextmanager
    def locked(self):
        """While a dot runs: no network, no new processes."""
        self._locked.set()
        try:
            yield
        finally:
            self._locked.clear()

    def hook(self, event, args):
        if event == "open":
            path, mode, flags = args
            writing = (flags or 0) & WRITE_FLAGS or (mode and any(c in mode for c in "wax+"))
            if writing and not self.allows(path):
                raise SandboxError(f"sandbox: write blocked: {path}")
        elif event in CHANGE:
            if not self.allows(args[0]):
                raise SandboxError(f"sandbox: {event} blocked: {args[0]}")
        elif event == "os.rename":
            if not (self.allows(args[0]) and self.allows(args[1])):
                raise SandboxError(f"sandbox: rename blocked: {args[0]}")
        elif self._locked.is_set():
            if event == "socket.connect":
                address = args[1]
                host = address[0] if isinstance(address, tuple) else address
                if host not in LOOPBACK:
                    raise SandboxError(f"sandbox: network blocked while a dot runs: {host}")
            elif event in SPAWN or event.startswith("os.exec") or event.startswith("os.spawn"):
                raise SandboxError(f"sandbox: {event} blocked while a dot runs")


_installed: Sandbox | None = None


def install(home) -> Sandbox:
    """Turn on the sandbox for this process. Caches are moved inside `home` first."""
    global _installed
    if _installed:
        return _installed
    home = os.path.realpath(home)
    os.makedirs(home, exist_ok=True)
    for var, sub in [("HF_HOME", "models"), ("XDG_CACHE_HOME", "cache"), ("TORCH_HOME", "cache/torch"),
                     ("TRITON_CACHE_DIR", "cache/triton"), ("TORCHINDUCTOR_CACHE_DIR", "cache/inductor")]:
        os.environ.setdefault(var, os.path.join(home, sub))
    sys.dont_write_bytecode = True  # no .pyc writes into the app's own folder
    _installed = Sandbox([home, tempfile.gettempdir()])
    sys.addaudithook(_installed.hook)
    return _installed


def locked():
    """`with locked():` while a dot runs. No-op if the sandbox is off."""
    return _installed.locked() if _installed else contextlib.nullcontext()
