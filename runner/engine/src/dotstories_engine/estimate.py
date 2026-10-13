"""How long will a Run take? Rough numbers from docs/hardware.md, replaced by measurements later."""
from dataclasses import asdict, dataclass

M = 60
# tier: (min seconds, max seconds), for the Krea dot at 2 MP / 8 steps
RUN = {
    "nvidia-16": (5, 15),
    "nvidia-12": (15, 40),
    "nvidia-8": (1 * M, 3 * M),
    "nvidia-6": (3 * M, 8 * M),
    "mac-16": (1 * M, 6 * M),
    "mac-8": (10 * M, 20 * M),
    "cpu-16": (30 * M, 90 * M),
    "cpu-8": (60 * M, 180 * M),
}
DOWNLOAD_GB = 36  # Krea 2 Turbo bf16 (~26) + text encoder (~8) + VAE + torch, first run only
GB_PER_MINUTE = 1.0  # median broadband ~130 Mbps

WARNINGS = {
    "cpu-16": "Your computer has no GPU. It works, just slowly. You can leave it running.",
    "cpu-8": "Your computer has 8 GB of memory. It will be very slow and may fail.",
    "mac-8": "Your Mac has 8 GB of memory. It will be slow and may fail.",
}


@dataclass
class Estimate:
    run_seconds: tuple[int, int]
    label: str
    download_gb: float
    download_minutes: int
    warning: str | None

    def to_dict(self):
        return asdict(self)


def human(lo: int, hi: int) -> str:
    if hi < M:
        return f"~{lo}–{hi} seconds"
    return f"~{lo // M}–{hi // M} minutes"


def estimate(tier: str) -> Estimate:
    lo, hi = RUN[tier]
    label = human(lo, hi) + (" (no GPU)" if tier.startswith("cpu") else "")
    return Estimate((lo, hi), label, DOWNLOAD_GB, round(DOWNLOAD_GB / GB_PER_MINUTE), WARNINGS.get(tier))
