"""Download progress for the live log: watches the model folder grow.

Hugging Face downloads print progress bars to the console, which nobody sees. So while the model
loads, we look at the model's cache folder every few seconds and report it as log lines:
- per big file: started, every quarter (size, %, speed), done. A file downloads to blobs/<id>.incomplete.
- the whole download: now and then, plus a line when nothing moves for a while.
"""
import contextlib
import threading
import time
from dataclasses import dataclass
from pathlib import Path

MB = 1024**2
GB = 1024**3


def folder_size(folder: Path) -> int:
    """Bytes in the folder. Links are skipped (Hugging Face links snapshot files to blobs)."""
    total = 0
    for f in Path(folder).rglob("*"):
        try:
            if not f.is_symlink() and f.is_file():
                total += f.stat().st_size
        except OSError:
            pass  # a file finished (renamed) while we looked
    return total


def clock(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m // 60}:{m % 60:02d}:{s:02d}" if m >= 60 else f"{m}:{s:02d}"


def describe(done: int, total: int, speed: float) -> str:
    total = max(total, done)
    line = f"Downloading the model: {done / GB:.1f} of ~{total / GB:.0f} GB"
    if speed > 0:
        line += f" · {speed / 1024**2:.0f} MB/s · ~{clock((total - done) / speed)} left"
    return line


def human_size(b: float) -> str:
    if b >= GB:
        return f"{b / GB:.1f} GB"
    return f"{b / MB:.0f} MB" if b >= MB else f"{b / 1024:.0f} KB"


# ---------- per file ----------

@dataclass(frozen=True)
class RepoFile:
    name: str  # path in the repo, e.g. transformer/diffusion_pytorch_model-00001-of-00005.safetensors
    size: int
    blob: str  # its file name in the cache's blobs/ folder

    @property
    def component(self) -> str:
        return self.name.split("/")[0] if "/" in self.name else "config"


def _get(o, key):
    return o.get(key) if isinstance(o, dict) else getattr(o, key, None)


def repo_files(siblings) -> list[RepoFile]:
    """From Hugging Face's file list (model_info(files_metadata=True).siblings)."""
    files = []
    for s in siblings:
        lfs = _get(s, "lfs")
        blob = _get(lfs, "sha256") if lfs else _get(s, "blob_id")
        size = _get(s, "size") or (_get(lfs, "size") if lfs else None) or 0
        if blob:
            files.append(RepoFile(_get(s, "rfilename"), size, blob))
    return files


def fetch_repo_files(model: str) -> list[RepoFile]:
    """The model's files on Hugging Face. Empty if it can't tell: then only the total is shown."""
    try:
        from huggingface_hub import HfApi

        return repo_files(HfApi().model_info(model, files_metadata=True).siblings or [])
    except Exception:
        return []


def components_line(files: list[RepoFile], skip=frozenset()) -> str | None:
    """e.g. "Model files: transformer 26.0 GB · text_encoder 8.2 GB · vae 160 MB" (biggest first)."""
    sizes = {}
    for f in files:
        if f.component not in skip:
            sizes[f.component] = sizes.get(f.component, 0) + f.size
    parts = [f"{c} {human_size(n)}" for c, n in sorted(sizes.items(), key=lambda kv: -kv[1]) if n >= MB]
    return "Model files: " + " · ".join(parts) if parts else None


class FileWatch:
    """Lines for big files as they download: started, each new quarter, done."""

    def __init__(self, files: list[RepoFile], blobs: Path, min_size: int = 50 * MB):
        self.files = [f for f in files if f.size >= min_size]
        self.blobs = Path(blobs)
        self.seen = {}  # blob -> [start t, start bytes, last report t, last report bytes, quarter]
        self.done = set()
        self.first = True

    def _line(self, mark: str, f: RepoFile, rest: str) -> str:
        return f"{mark} {f.component} · {f.name.rsplit('/', 1)[-1]} · {rest}"

    def tick(self, now: float) -> list[str]:
        lines = []
        for f in self.files:
            if f.blob in self.done:
                continue
            part, whole = self.blobs / f"{f.blob}.incomplete", self.blobs / f.blob
            try:
                if whole.is_file():
                    self.done.add(f.blob)
                    if f.blob in self.seen:  # downloaded while we watched
                        t0, b0 = self.seen[f.blob][:2]
                        speed = (f.size - b0) / max(now - t0, 1e-6)
                        lines.append(self._line("✓", f, f"{human_size(f.size)} · {human_size(speed)}/s"))
                    elif not self.first:
                        lines.append(self._line("✓", f, human_size(f.size)))
                    continue
                if not part.is_file():
                    continue
                size = part.stat().st_size
            except OSError:
                continue  # renamed while we looked: next tick sees it done
            if f.blob not in self.seen:
                self.seen[f.blob] = [now, size, now, size, 0]
                lines.append(self._line("↓", f, human_size(f.size)))
                continue
            state = self.seen[f.blob]
            quarter = min(int(size * 4 / max(f.size, 1)), 3)
            if quarter > state[4]:
                speed = (size - state[3]) / max(now - state[2], 1e-6)
                unit = GB if f.size >= GB else MB
                done = f"{size / unit:.1f}" if unit == GB else f"{size / unit:.0f}"
                lines.append(self._line("↓", f, f"{done} / {human_size(f.size)} ({size * 100 // f.size}%) · "
                                                f"{human_size(speed)}/s"))
                state[2:] = [now, size, quarter]
        self.first = False
        return lines


# ---------- the whole download ----------

@contextlib.contextmanager
def download_monitor(emit, folder: Path, total_gb: float, files=(), every: float = 5.0,
                     overall_every: float = 30.0, quiet_every: float = 30.0, min_size: int = 50 * MB):
    """While the block runs: lines per big file, the total now and then, and one when nothing moves."""
    stop = threading.Event()
    total = int(total_gb * GB)
    watch = FileWatch(list(files), Path(folder) / "blobs", min_size)

    def say(message):
        emit({"event": "log", "message": message})

    def loop():
        start = time.monotonic()
        for line in watch.tick(start):
            say(line)
        last, last_t, quiet_since, said_quiet = folder_size(folder), start, start, 0.0
        said_total = start - overall_every  # first move: say the total right away
        while not stop.wait(every):
            now, t = folder_size(folder), time.monotonic()
            for line in watch.tick(t):
                say(line)
            if now > last:
                if t - said_total >= overall_every:
                    say(describe(now, total, (now - last) / (t - last_t)))
                    said_total = t
                quiet_since, said_quiet = t, 0.0
            elif t - quiet_since - said_quiet >= quiet_every:
                said_quiet = t - quiet_since
                say(f"Working… no new download data for {clock(said_quiet)} "
                    "(loading the model into memory, or Hugging Face is slow)")
            last, last_t = now, t

    thread = threading.Thread(target=loop, daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        thread.join(timeout=every + 1)
