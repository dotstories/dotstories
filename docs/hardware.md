# Hardware & time estimates

> Estimates, rounded. Used by the runner to show "how long will this take" before Run.

## Who has what

| Hardware | General users (est.) | Gamers / creators (Steam, Sept 2026) |
|---|---|---|
| NVIDIA 16 GB+ | ~5% | ~33% |
| NVIDIA 12 GB | ~3% | ~13% |
| NVIDIA 8 GB | ~7% | ~27% |
| Weak GPU (≤6 GB, AMD, Intel) | ~5% | ~10% |
| Mac M-series 16 GB+ | ~12% | — |
| Mac M-series 8 GB | ~6% | — |
| CPU only | ~62% | small |

How: Statcounter desktop OS (Windows ~57%, Mac ~16%, Linux ~4%, June 2026), Jon Peddie Q2 2026 (NVIDIA ~23% of consumer PC graphics), Steam VRAM split. Assumed: ~85% of active Macs are Apple Silicon; Mac RAM split.

## Time per Run

Krea dot: 2 MP, 8 steps. Audio: 3-minute track, Stable Audio 3 Medium.

| Tier | Krea dot | Audio |
|---|---|---|
| NVIDIA 16 GB+ | 5–15 s | ~10 s |
| NVIDIA 12 GB | 15–40 s | 15–30 s |
| NVIDIA 8 GB | 1–3 min | 30–60 s |
| NVIDIA ≤6 GB | 3–8 min | 1–3 min |
| Mac 16 GB+ | 1–6 min | 1–3 min |
| Mac 8 GB | 10–20 min (may fail) | 3–6 min |
| CPU, 16 GB+ RAM | 30–90 min | 10–30 min |
| CPU, 8 GB RAM | run with warning, may fail | 20–40 min |

First run download (median broadband ~130 Mbps ≈ 1 GB/min):
- Krea dot ~20 GB ≈ 20 min (Mac ~30 GB ≈ 30 min)
- Audio dot ~5 GB ≈ 5 min

Basis: Krea's ~2 s at 2K claim on top consumer hardware, scaled by GPU speed. Stability's H200 timing (1.3 s, Medium). No independent consumer benchmarks found yet: **iteration 0 replaces these with measured numbers.**

## How the site shows it

- v1: hardware tier → table above → "~10 seconds", "~45 minutes, your PC has no GPU", etc.
- v2: 10-second calibration step on install + live progress ("step 3/8 · 2 min left").

## Test machines

| Machine | Covers | Notes |
|---|---|---|
| i7-14700KF + RTX 4080 16 GB (Windows) | NVIDIA 16 GB+ | Fast path, AppContainer + CUDA test |
| same PC, GPU limited to 8/12 GB | NVIDIA 8 / 12 GB | `torch.cuda.set_per_process_memory_fraction` |
| same PC, CPU forced | CPU only | KF has no iGPU; RAM decides the tier |
| MacBook Pro M4 16 GB | Mac 16 GB | Hardest case: bf16 (26 GB) won't fit → quantized engine (MLX / 4–8 bit) |

"Fresh install" test = a new, empty user account on each machine.

Not covered yet: AMD GPUs, 8 GB Macs, Intel Macs, Linux → beta testers later.

## Sources

- Steam Survey Sept 2026: https://www.digitalcitizen.life/nvidia-rtx-5070-most-popular-gpu-steam-hardware-survey-september-2026/
- Statcounter desktop OS: https://linuxiac.com/windows-drops-un
- Jon Peddie Q2 2026: https://www.techspot.com/news/113751-discrete-gpu-shipments-surged-122-despite-weaker-pc.html
- Krea 2 Turbo speed: https://aiweekly.co/alerts/krea-releases-12b-image-weights-for-2-second-2k-generation
- Krea 2 variants/VRAM: https://www.stablediffusiontutorials.com/2026/06/krea2-base-turbo.html
- Stable Audio 3: https://the-decoder.com/stability-ai-launches-stable-audio-3-0-with-up-to-six-minute-tracks-and-open-weights/
- Broadband: https://www.statista.com/statistics/896779/average-internet-connection-speed-worldwide/
