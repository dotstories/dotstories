import json
import struct

from dotstories_engine.models import (
    KREA_TURBO,
    Reuse,
    comfy_model_dirs,
    find_comfy_file,
    find_hf_snapshot,
    hf_cache_dirs,
    scan,
)

KREA_KEY = "model.diffusion_model.txtfusion.projector.weight"


def safetensors(path, keys=(KREA_KEY,), pad=0):
    """A tiny file with a real safetensors header (contents don't matter)."""
    header = json.dumps({k: {"dtype": "BF16", "shape": [1], "data_offsets": [0, 2]} for k in keys}).encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<Q", len(header)) + header + b"\0\0" + b"\0" * pad)
    return path


def snapshot(root, repo="krea/Krea-2-Turbo", complete=True):
    snap = root / f"models--{repo.replace('/', '--')}" / "snapshots" / "abc123"
    (snap / "transformer").mkdir(parents=True)
    (snap / "model_index.json").write_text("{}")
    index = {"weight_map": {"a": "diffusion_pytorch_model-00001-of-00002.safetensors",
                            "b": "diffusion_pytorch_model-00002-of-00002.safetensors"}}
    (snap / "transformer" / "diffusion_pytorch_model.safetensors.index.json").write_text(json.dumps(index))
    safetensors(snap / "transformer" / "diffusion_pytorch_model-00001-of-00002.safetensors")
    if complete:
        safetensors(snap / "transformer" / "diffusion_pytorch_model-00002-of-00002.safetensors")
    return snap


# ---------- Hugging Face cache ----------

def test_hf_cache_locations_follow_hf_env_vars(tmp_path):
    home = tmp_path / "home"
    assert hf_cache_dirs({}, home) == [home / ".cache" / "huggingface" / "hub"]
    assert hf_cache_dirs({"HF_HOME": "/x"}, home)[0].as_posix() == "/x/hub"
    assert hf_cache_dirs({"HF_HUB_CACHE": "/y"}, home)[0].as_posix() == "/y"


def test_complete_snapshot_is_found(tmp_path):
    snap = snapshot(tmp_path)
    assert find_hf_snapshot(KREA_TURBO, [tmp_path]) == snap


def test_half_downloaded_snapshot_is_ignored(tmp_path):
    snapshot(tmp_path, complete=False)
    assert find_hf_snapshot(KREA_TURBO, [tmp_path]) is None


def test_missing_cache_folder_is_fine(tmp_path):
    assert find_hf_snapshot(KREA_TURBO, [tmp_path / "nope"]) is None


# ---------- ComfyUI ----------

def test_comfyui_desktop_install_is_found(tmp_path):
    home, base = tmp_path / "home", tmp_path / "Documents" / "ComfyUI"
    config = home / "AppData" / "Roaming" / "ComfyUI" / "config.json"
    config.parent.mkdir(parents=True)
    config.write_text(json.dumps({"basePath": str(base)}))
    (base / "models" / "diffusion_models").mkdir(parents=True)
    dirs = comfy_model_dirs({"APPDATA": str(home / "AppData" / "Roaming")}, home, running=None)
    assert base / "models" / "diffusion_models" in dirs


def test_comfyui_portable_and_extra_model_paths(tmp_path):
    home = tmp_path / "home"
    root = home / "ComfyUI_windows_portable" / "ComfyUI"
    (root / "models" / "unet").mkdir(parents=True)
    extra = tmp_path / "big-disk" / "ai"
    (extra / "diffusion").mkdir(parents=True)
    (root / "extra_model_paths.yaml").write_text(
        f"mine:\n    base_path: {extra.as_posix()}\n    diffusion_models: |\n        diffusion\n"
    )
    dirs = comfy_model_dirs({}, home, running=None)
    assert root / "models" / "unet" in dirs
    assert extra / "diffusion" in dirs


def test_running_comfyui_tells_us_its_folders(tmp_path):
    folder = tmp_path / "anywhere" / "diffusion_models"
    folder.mkdir(parents=True)
    dirs = comfy_model_dirs({}, tmp_path / "home", running={"diffusion_models": [[str(folder)], [".safetensors"]]})
    assert folder in dirs


def test_finds_the_krea_file_and_prefers_bf16(tmp_path):
    d = tmp_path / "diffusion_models"
    safetensors(d / "krea2_turbo_fp8_scaled.safetensors")
    assert find_comfy_file([d]).name == "krea2_turbo_fp8_scaled.safetensors"
    safetensors(d / "krea2_turbo_bf16.safetensors")
    assert find_comfy_file([d]).name == "krea2_turbo_bf16.safetensors"


def test_ignores_a_file_that_is_not_krea(tmp_path):
    d = tmp_path / "diffusion_models"
    safetensors(d / "krea2_turbo_bf16.safetensors", keys=("something.else",))
    (d / "krea2_turbo_fp8_scaled.safetensors").write_bytes(b"not a model")
    assert find_comfy_file([d]) is None


# ---------- scan: what can we reuse, how much does it save ----------

def test_scan_prefers_a_full_snapshot(tmp_path):
    snap = snapshot(tmp_path / "hf")
    r = scan({"HF_HUB_CACHE": str(tmp_path / "hf")}, tmp_path / "home", running=None)
    assert r.snapshot == snap and r.saved_gb > 30
    assert "Hugging Face" in r.summary


def test_scan_uses_comfyui_transformer(tmp_path):
    home = tmp_path / "home"
    safetensors(home / "ComfyUI" / "models" / "diffusion_models" / "krea2_turbo_bf16.safetensors")
    r = scan({}, home, running=None)
    assert r.snapshot is None and r.transformer.name == "krea2_turbo_bf16.safetensors"
    assert r.saved_gb == 26
    assert r.summary == "Found Krea 2 in ComfyUI · saves 26 GB"


def test_nothing_found(tmp_path):
    r = scan({}, tmp_path / "home", running=None)
    assert r == Reuse() and r.saved_gb == 0 and r.summary is None
