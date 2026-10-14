"""How to fit a 12.9B model (26 GB in bf16) into this computer's memory."""
from .hardware import Hardware

PLANS = {
    "gpu-bf16": "everything on the GPU",
    "gpu-fp8-offload": "weights stored in fp8 (~13 GB), parts not in use wait in RAM",
    "gpu-fp8-stream": "weights stored in fp8, streamed to the GPU block by block",
    "mps-bf16": "Apple GPU, bf16 (quantized Mac engine comes in step 5)",
    "cpu-fp8": "CPU only, weights stored in fp8 to save RAM",
}


def memory_plan(hw: Hardware) -> str:
    if hw.device == "cuda":
        vram = round(hw.vram_gb)
        return "gpu-bf16" if vram >= 32 else "gpu-fp8-offload" if vram >= 16 else "gpu-fp8-stream"
    return "mps-bf16" if hw.device == "mps" else "cpu-fp8"
