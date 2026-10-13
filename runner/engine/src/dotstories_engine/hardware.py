"""What is this computer? Device, GPU memory, RAM -> a speed tier."""
import platform
from dataclasses import asdict, dataclass

import psutil


@dataclass
class Hardware:
    device: str  # "cuda", "mps" or "cpu"
    name: str
    vram_gb: float  # dedicated GPU memory (0 on Mac and CPU)
    ram_gb: float

    def to_dict(self):
        return asdict(self)


def detect() -> Hardware:
    ram = psutil.virtual_memory().total / 2**30
    try:
        import torch
    except ImportError:  # engine installed without ML extras
        return Hardware("cpu", platform.processor() or "CPU", 0, ram)
    if torch.cuda.is_available():
        p = torch.cuda.get_device_properties(0)
        return Hardware("cuda", p.name, p.total_memory / 2**30, ram)
    if torch.backends.mps.is_available():
        return Hardware("mps", platform.processor() or "Apple GPU", 0, ram)
    return Hardware("cpu", platform.processor() or "CPU", 0, ram)


def tier(hw: Hardware) -> str:
    """Tiers match docs/hardware.md. GPUs report a bit less than the box says, so round."""
    if hw.device == "cuda":
        vram = round(hw.vram_gb)
        return "nvidia-16" if vram >= 16 else "nvidia-12" if vram >= 12 else "nvidia-8" if vram >= 8 else "nvidia-6"
    ram = round(hw.ram_gb)
    if hw.device == "mps":
        return "mac-16" if ram >= 16 else "mac-8"
    return "cpu-16" if ram >= 16 else "cpu-8"
