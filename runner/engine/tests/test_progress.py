import time

from dotstories_engine.progress import GB, clock, describe, download_monitor, folder_size


def test_folder_size_skips_links(tmp_path):
    (tmp_path / "blobs").mkdir()
    (tmp_path / "blobs" / "a").write_bytes(b"x" * 100)
    (tmp_path / "blobs" / "b.incomplete").write_bytes(b"x" * 50)
    try:
        (tmp_path / "snapshot").symlink_to(tmp_path / "blobs" / "a")
    except OSError:
        pass  # Windows without symlink rights: nothing to skip
    assert folder_size(tmp_path) == 150


def test_missing_folder_is_empty(tmp_path):
    assert folder_size(tmp_path / "nope") == 0


def test_describe():
    assert describe(12 * GB, 34 * GB, 50 * 1024**2) == "Downloading the model: 12.0 of ~34 GB · 50 MB/s · ~7:30 left"
    assert describe(40 * GB, 34 * GB, 0) == "Downloading the model: 40.0 of ~40 GB"  # bigger than guessed


def test_clock():
    assert clock(5) == "0:05"
    assert clock(3725) == "1:02:05"


def test_reports_progress_and_quiet_spells(tmp_path):
    lines = []
    emit = lambda e: lines.append(e["message"])  # noqa: E731
    with download_monitor(emit, tmp_path, total_gb=1, every=0.05, quiet_every=0.2):
        (tmp_path / "part.incomplete").write_bytes(b"x" * 1024**2)
        time.sleep(0.15)
        time.sleep(0.4)  # nothing new: "Working…"
    assert any(line.startswith("Downloading the model: 0.0 of ~1 GB") for line in lines)
    assert any(line.startswith("Working… no new download data") for line in lines)
    n = len(lines)
    time.sleep(0.2)
    assert len(lines) == n  # stopped with the block
