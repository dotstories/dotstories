"""Download progress for the live log: watches the model folder grow.

Hugging Face downloads print progress bars to the console, which nobody sees. So while the model
loads, we measure the model's cache folder every few seconds and report it as a log line.
"""
import contextlib
import threading
import time
from pathlib import Path

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


@contextlib.contextmanager
def download_monitor(emit, folder: Path, total_gb: float, every: float = 5.0, quiet_every: float = 30.0):
    """While the block runs: a log line when the download moves, and one when it doesn't for a while."""
    stop = threading.Event()
    total = int(total_gb * GB)

    def loop():
        last, last_t, quiet_since, said_quiet = folder_size(folder), time.monotonic(), time.monotonic(), 0.0
        while not stop.wait(every):
            now, t = folder_size(folder), time.monotonic()
            if now > last:
                emit({"event": "log", "message": describe(now, total, (now - last) / (t - last_t))})
                quiet_since, said_quiet = t, 0.0
            elif t - quiet_since - said_quiet >= quiet_every:
                said_quiet = t - quiet_since
                emit({"event": "log", "message": f"Working… no new download data for {clock(said_quiet)} "
                                                  "(loading the model into memory, or Hugging Face is slow)"})
            last, last_t = now, t

    thread = threading.Thread(target=loop, daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        thread.join(timeout=every + 1)
