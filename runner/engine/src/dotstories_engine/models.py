"""Reuse models the user already has, so nothing is downloaded twice.

Looks in (read-only, never changes these folders):
- the Hugging Face cache (a complete Krea 2 Turbo download): ours and the person's default one
- ComfyUI: a running ComfyUI, Comfy Desktop (old and new), portable installs, extra_model_paths.yaml
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
COMFY_DESKTOP = "Comfy-Desktop"  # new Comfy Desktop: <LOCALAPPDATA or drive>/Comfy-Desktop/ComfyUI-{Shared,Installs}
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
    """Env vars first, then the default cache: the app sets its own HF_HOME,
    but the person may already have the model in their normal Hugging Face cache."""
    dirs = []
    if env.get("HF_HUB_CACHE"):
        dirs.append(Path(env["HF_HUB_CACHE"]))
    if env.get("HF_HOME"):
        dirs.append(Path(env["HF_HOME"]) / "hub")
    dirs.append(home / ".cache" / "huggingface" / "hub")
    return list(dict.fromkeys(dirs))


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
    # New Comfy Desktop: shared models + one folder per install.
    local = Path(env.get("LOCALAPPDATA", home / "AppData" / "Local"))
    for base in [local / COMFY_DESKTOP, home, Path("C:/") / COMFY_DESKTOP, Path("D:/") / COMFY_DESKTOP]:
        roots.append(base / "ComfyUI-Shared")
        try:
            roots += [d for d in (base / "ComfyUI-Installs").iterdir() if d.is_dir()]
        except OSError:
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


def _renamed(d: Path) -> list[Path]:
    """A renamed copy: "krea" in the name is enough to look, the header check decides."""
    try:
        return sorted(f for f in d.glob("*.safetensors") if "krea" in f.name.lower() and f.name not in COMFY_FILES)
    except OSError:
        return []


def find_comfy_file(model_dirs: list[Path]) -> Path | None:
    known = [d / name for name in COMFY_FILES for d in model_dirs]  # known names first, bf16 preferred
    renamed = [f for d in model_dirs for f in _renamed(d)]
    return next((f for f in known + renamed if f.is_file() and _is_krea(f)), None)


# ---------- all together ----------

def scan(env=None, home: Path | None = None, running="ask") -> Reuse:
    env = os.environ if env is None else env
    home = Path.home() if home is None else home
    snap = find_hf_snapshot(KREA_TURBO, hf_cache_dirs(env, home))
    if snap:
        return Reuse(snapshot=snap)
    running = running_comfyui() if running == "ask" else running
    return Reuse(transformer=find_comfy_file(comfy_model_dirs(env, home, running)))
