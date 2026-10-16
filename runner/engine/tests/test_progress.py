import time

from types import SimpleNamespace as NS

from dotstories_engine.progress import (
    GB,
    MB,
    FileWatch,
    RepoFile,
    clock,
    components_line,
    describe,
    download_monitor,
    folder_size,
    human_size,
    repo_files,
)


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
    with download_monitor(emit, tmp_path, total_gb=1, every=0.05, overall_every=0.05, quiet_every=0.2):
        (tmp_path / "part.incomplete").write_bytes(b"x" * 1024**2)
        time.sleep(0.15)
        time.sleep(0.4)  # nothing new: "Working…"
    assert any(line.startswith("Downloading the model: 0.0 of ~1 GB") for line in lines)
    assert any(line.startswith("Working… no new download data") for line in lines)
    n = len(lines)
    time.sleep(0.2)
    assert len(lines) == n  # stopped with the block


# ---------- per file ----------

BIG = "transformer/diffusion_pytorch_model-00002-of-00005.safetensors"


def test_repo_files_from_hugging_face_metadata():
    siblings = [
        NS(rfilename=BIG, size=10 * GB, lfs=NS(sha256="aaa", size=10 * GB), blob_id="git1"),
        NS(rfilename="model_index.json", size=500, lfs=None, blob_id="git2"),
        NS(rfilename="vae/x.safetensors", size=None, lfs={"sha256": "bbb", "size": 160 * MB}, blob_id="git3"),
        NS(rfilename="README.md", size=None, lfs=None, blob_id=None),  # nothing to match: skipped
    ]
    assert repo_files(siblings) == [RepoFile(BIG, 10 * GB, "aaa"), RepoFile("model_index.json", 500, "git2"),
                                    RepoFile("vae/x.safetensors", 160 * MB, "bbb")]


def test_component_is_the_top_folder():
    assert RepoFile(BIG, 1, "a").component == "transformer"
    assert RepoFile("model_index.json", 1, "b").component == "config"


def test_human_size():
    assert human_size(int(9.8 * GB)) == "9.8 GB"
    assert human_size(160 * MB) == "160 MB"


def test_components_line_skips_what_is_reused():
    files = [RepoFile(BIG, 26 * GB, "a"), RepoFile("text_encoder/m.safetensors", int(8.2 * GB), "b"),
             RepoFile("vae/v.safetensors", 160 * MB, "c")]
    assert components_line(files) == "Model files: transformer 26.0 GB · text_encoder 8.2 GB · vae 160 MB"
    assert components_line(files, skip={"transformer"}) == "Model files: text_encoder 8.2 GB · vae 160 MB"
    assert components_line([]) is None


def grow(blobs, blob, size):
    (blobs / f"{blob}.incomplete").write_bytes(b"x" * size)


def finish(blobs, blob):
    (blobs / f"{blob}.incomplete").rename(blobs / blob)


def test_file_watch_reports_start_quarters_and_done(tmp_path):
    blobs = tmp_path / "blobs"
    blobs.mkdir()
    w = FileWatch([RepoFile(BIG, 100 * MB, "aaa"), RepoFile("model_index.json", 500, "tiny")], blobs, min_size=MB)
    assert w.tick(0) == []  # nothing yet
    grow(blobs, "aaa", 10 * MB)
    assert w.tick(1) == ["↓ transformer · diffusion_pytorch_model-00002-of-00005.safetensors · 100 MB"]
    grow(blobs, "aaa", 30 * MB)
    assert w.tick(5) == ["↓ transformer · diffusion_pytorch_model-00002-of-00005.safetensors · 30 / 100 MB (30%) · 5 MB/s"]
    grow(blobs, "aaa", 40 * MB)
    assert w.tick(6) == []  # no new quarter: no line
    grow(blobs, "aaa", 100 * MB)
    finish(blobs, "aaa")
    (blobs / "tiny").write_bytes(b"{}")  # small files: no lines
    assert w.tick(10) == ["✓ transformer · diffusion_pytorch_model-00002-of-00005.safetensors · 100 MB · 10 MB/s"]
    assert w.tick(11) == []  # said once


def test_file_watch_is_quiet_about_files_already_here(tmp_path):
    blobs = tmp_path / "blobs"
    blobs.mkdir()
    (blobs / "aaa").write_bytes(b"x" * (2 * MB))
    w = FileWatch([RepoFile(BIG, 2 * MB, "aaa")], blobs, min_size=MB)
    assert w.tick(0) == [] and w.tick(1) == []


def test_file_watch_without_a_blobs_folder(tmp_path):
    assert FileWatch([RepoFile(BIG, 2 * MB, "aaa")], tmp_path / "nope").tick(0) == []


def test_monitor_adds_file_lines(tmp_path):
    lines = []
    blobs = tmp_path / "blobs"
    blobs.mkdir()
    files = [RepoFile("vae/v.safetensors", 4 * MB, "vvv")]
    with download_monitor(lambda e: lines.append(e["message"]), tmp_path, total_gb=1, files=files,
                          every=0.05, overall_every=10, quiet_every=10, min_size=MB):
        grow(blobs, "vvv", 1)
        time.sleep(0.15)
        finish(blobs, "vvv")
        time.sleep(0.15)
    assert "↓ vae · v.safetensors · 4 MB" in lines
    assert any(line.startswith("✓ vae · v.safetensors") for line in lines)
