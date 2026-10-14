"""Reuse models the user already has, so nothing is downloaded twice.

Looks in (read-only, never changes these folders):
- the Hugging Face cache (a complete Krea 2 Turbo download)
- ComfyUI: a running ComfyUI, ComfyUI Desktop, portable installs, extra_model_paths.yaml
"""
import json
import os
import struct
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import yaml

KREA_TURBO = "krea/Krea-2-Turbo"
TRANSFORMER_GB = 26  # Krea 2 Turbo in bf16
SNAPSHOT_GB = 34  # transformer + text encoder + VAE
COMFY_FILES = ["krea2_turbo_bf16.safetensors", "krea2_turbo_fp8_scaled.safetensors"]  # preferred first
COMFY_FOLDERS = ["diffusion_models", "unet"]  # ComfyUI folder names for this model type
KREA_KEYS = ("txtfusion.projector.weight", "model.diffusion_model.txtfusion.projector.weight")
COMFY_PORTS = [8000, 8188]  # Desktop, portable


@dataclass
class Reuse:
    snapshot: Path | None = None  # complete Hugging Face download: use as is
    transformer: Path | None = None  # ComfyUI single file: reuse the big part

    @property
    def saved_gb(self) -> int:
        return SNAPSHOT_GB if self.snapshot else TRANSFORMER_GB if self.transformer else 0

    @property
    def summary(self) -> str | None:
        if self.snapshot:
            return f"Found Krea 2 in your Hugging Face cache · saves {self.saved_gb} GB"
        if self.transformer:
            return f"Found Krea 2 in ComfyUI · saves {self.saved_gb} GB"
        return None

    def to_dict(self):
        return {"snapshot": str(self.snapshot) if self.snapshot else None,
                "transformer": str(self.transformer) if self.transformer else None,
                "saved_gb": self.saved_gb, "summary": self.summary}


# ---------- Hugging Face ----------

def hf_cache_dirs(env, home: Path) -> list[Path]:
    if env.get("HF_HUB_CACHE"):
        return [Path(env["HF_HUB_CACHE"])]
    if env.get("HF_HOME"):
        return [Path(env["HF_HOME"]) / "hub"]
    return [home / ".cache" / "huggingface" / "hub"]


def _complete(snap: Path) -> bool:
    """Every file is there: no broken links, every shard listed in an index exists."""
    if not (snap / "model_index.json").is_file():
        return False
    for f in snap.rglob("*"):
        if f.is_symlink() and not f.exists():
            return False
        if f.name.endswith(".safetensors.index.json"):
            shards = set(json.loads(f.read_text()).get("weight_map", {}).values())
            if not all((f.parent / s).is_file() for s in shards):
                return False
    return True


def find_hf_snapshot(repo: str, cache_dirs: list[Path]) -> Path | None:
    for cache in cache_dirs:
        snaps = cache / f"models--{repo.replace('/', '--')}" / "snapshots"
        if snaps.is_dir():
            for snap in sorted(snaps.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
                if _complete(snap):
                    return snap
    return None


# ---------- ComfyUI ----------

def running_comfyui() -> dict | None:
    """Ask a running ComfyUI where its models are (same API as the Dark Fantasy Kit)."""
    for port in COMFY_PORTS:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/internal/folder_paths", timeout=0.5) as r:
                return json.load(r)
        except Exception:
            continue
    return None


def _comfy_roots(env, home: Path) -> list[Path]:
    roots = []
    # ComfyUI Desktop remembers where it installed things.
    for config in [Path(env.get("APPDATA", home / "AppData" / "Roaming")) / "ComfyUI" / "config.json",
                   home / "Library" / "Application Support" / "ComfyUI" / "config.json"]:
        try:
            roots.append(Path(json.loads(config.read_text())["basePath"]))
        except (OSError, ValueError, KeyError):
            pass
    # Common places for manual and portable installs.
    for parent in [home, home / "Documents", home / "Desktop", home / "Downloads", Path("C:/"), Path("D:/")]:
        try:
            for d in parent.glob("ComfyUI*"):
                roots += [d, d / "ComfyUI"]
        except OSError:
            pass
    return [r for r in roots if r.is_dir()]


def _extra_paths(root: Path) -> list[Path]:
    """extra_model_paths.yaml: model folders on other disks."""
    try:
        config = yaml.safe_load((root / "extra_model_paths.yaml").read_text()) or {}
    except (OSError, yaml.YAMLError):
        return []
    found = []
    for section in config.values():
        if not isinstance(section, dict):
            continue
        base = Path(section.get("base_path", root))
        base = base if base.is_absolute() else root / base
        for kind in COMFY_FOLDERS:
            for line in str(section.get(kind, "")).splitlines():
                if line.strip():
                    found.append(base / line.strip())
    return found


def comfy_model_dirs(env, home: Path, running: dict | None) -> list[Path]:
    dirs = []
    if running:
        for kind in COMFY_FOLDERS:
            entry = running.get(kind) or []
            paths = entry[0] if entry and isinstance(entry[0], list) else entry
            dirs += [Path(p) for p in paths]
    for root in _comfy_roots(env, home):
        dirs += [root / "models" / kind for kind in COMFY_FOLDERS]
        dirs += _extra_paths(root)
    unique = []
    for d in dirs:
        if d.is_dir() and d not in unique:
            unique.append(d)
    return unique


def _is_krea(path: Path) -> bool:
    """Read only the safetensors header: is this really Krea 2?"""
    try:
        with path.open("rb") as f:
            size = struct.unpack("<Q", f.read(8))[0]
            if size > 100_000_000:
                return False
            header = json.loads(f.read(size))
        return any(k in header for k in KREA_KEYS)
    except (OSError, ValueError, struct.error):
        return False


def find_comfy_file(model_dirs: list[Path]) -> Path | None:
    for name in COMFY_FILES:
        for d in model_dirs:
            if (d / name).is_file() and _is_krea(d / name):
                return d / name
    return None


# ---------- all together ----------

def scan(env=None, home: Path | None = None, running="ask") -> Reuse:
    env = os.environ if env is None else env
    home = Path.home() if home is None else home
    snap = find_hf_snapshot(KREA_TURBO, hf_cache_dirs(env, home))
    if snap:
        return Reuse(snapshot=snap)
    running = running_comfyui() if running == "ask" else running
    return Reuse(transformer=find_comfy_file(comfy_model_dirs(env, home, running)))
