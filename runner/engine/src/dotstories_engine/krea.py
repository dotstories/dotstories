"""Krea 2 Turbo through diffusers. No ComfyUI."""
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

MODEL = os.environ.get("DOTSTORIES_KREA_MODEL", "krea/Krea-2-Turbo")


@dataclass
class Job:
    prompt: str
    style: str
    seed: int
    width: int = 1920
    height: int = 1088
    steps: int = 8  # Turbo is distilled for 8 steps

    @property
    def full_prompt(self) -> str:
        return f"{self.prompt}. {self.style}"

    @property
    def size(self) -> tuple[int, int]:
        return round(self.width / 16) * 16, round(self.height / 16) * 16


def load_job(path) -> Job:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    return Job(d["prompt"], d["style"], d["seed"], d.get("width", 1920), d.get("height", 1088), d.get("steps", 8))


def load_comfy_transformer(path):
    """Krea 2 transformer from a ComfyUI file (read in place, never copied).

    ComfyUI's fp8_scaled files store fp8 weights + a scale per layer: turn them back into bf16.
    """
    import torch
    from diffusers import Krea2Transformer2DModel
    from safetensors import safe_open

    state = {}
    with safe_open(str(path), framework="pt") as f:
        keys = set(f.keys())
        for key in keys:
            if key == "scaled_fp8" or key.endswith((".scale_weight", ".weight_scale", ".scale_input", ".input_scale",
                                                    ".comfy_quant")):
                continue
            t = f.get_tensor(key)
            if t.dtype in (torch.float8_e4m3fn, torch.float8_e5m2):
                base = key[: -len(".weight")] if key.endswith(".weight") else key
                scale = next((f.get_tensor(s) for s in (f"{base}.scale_weight", f"{base}.weight_scale") if s in keys), None)
                t = t.to(torch.bfloat16) * (scale.to(torch.bfloat16) if scale is not None else 1)
            state[key] = t.to(torch.bfloat16)
    return Krea2Transformer2DModel.from_single_file(state, config=MODEL, subfolder="transformer", torch_dtype=torch.bfloat16)


def _from_pretrained(reuse, emit):
    """Use what's on disk first; download only what's missing."""
    import torch
    from diffusers import Krea2Pipeline

    # safetensors only: pickle model files can run code when loaded.
    common = dict(dtype=torch.bfloat16, use_safetensors=True)
    if reuse and reuse.snapshot:
        try:
            return Krea2Pipeline.from_pretrained(str(reuse.snapshot), local_files_only=True, **common)
        except Exception as e:
            emit({"event": "warning", "message": f"Could not use the Hugging Face copy, downloading instead: {e}"})
    if reuse and reuse.transformer:
        try:
            transformer = load_comfy_transformer(reuse.transformer)
            # A passed component is not downloaded again.
            return Krea2Pipeline.from_pretrained(MODEL, transformer=transformer, **common)
        except Exception as e:
            emit({"event": "warning", "message": f"Could not use the ComfyUI file, downloading instead: {e}"})
    return Krea2Pipeline.from_pretrained(MODEL, **common)


def load_pipeline(plan: str, reuse=None, emit=lambda e: None):
    """Load the model (downloading what's missing), fitted to this computer's memory plan."""
    import torch

    pipe = _from_pretrained(reuse, emit)
    fp8 = dict(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16)

    if plan == "gpu-bf16":
        pipe.to("cuda")
    elif plan == "gpu-fp8-offload":
        pipe.transformer.enable_layerwise_casting(**fp8)
        pipe.enable_model_cpu_offload()
    elif plan == "gpu-fp8-stream":
        pipe.transformer.enable_layerwise_casting(**fp8)
        pipe.enable_group_offload(onload_device=torch.device("cuda"), offload_type="block_level", num_blocks_per_group=1)
    elif plan == "mps-bf16":
        pipe.to("mps")
    elif plan == "cpu-fp8":
        pipe.transformer.enable_layerwise_casting(**fp8)
    else:
        raise ValueError(f"Unknown plan: {plan}")
    return pipe


def make_generator(seed: int):
    """Seeded on the CPU so the same seed gives the same noise on every device."""
    import torch

    return torch.Generator("cpu").manual_seed(seed)


def generate(job: Job, pipe, generator, out: Path, on_progress) -> Path:
    start = time.monotonic()

    def step_done(_pipe, i, _t, kwargs):
        done = i + 1
        elapsed = time.monotonic() - start
        on_progress({
            "event": "progress",
            "step": done,
            "steps": job.steps,
            "elapsed": round(elapsed, 1),
            "eta": round(elapsed / done * (job.steps - done), 1),
        })
        return kwargs

    width, height = job.size
    image = pipe(
        prompt=job.full_prompt,
        width=width,
        height=height,
        num_inference_steps=job.steps,
        guidance_scale=0.0,  # Turbo: guidance off
        generator=generator,
        callback_on_step_end=step_done,
    ).images[0]

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out)
    return out
