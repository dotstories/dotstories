# DotStories engine

Runs a dot on your own computer. No ComfyUI. Step 1 of the runner spike.

Later the Runner app (Tauri) calls this for you. For now, run it by hand.

## Run it (Windows / Mac)

1. Install uv (installs Python for you):
   - Windows (PowerShell): `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
   - Mac: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. In this folder:

```bash
uv run --extra ml dotstories-engine info
uv run --extra ml dotstories-engine generate examples/dark-fantasy.json
```

- First `generate` downloads ~36 GB into `~/.dotstories/models`.
- The image lands in `~/.dotstories/output/image.png`.
- Every line printed is JSON: `start`, `loading`, `loaded`, `progress` (step x/8 + ETA), `done` or `error`.

Options: `--seed 123`, `--out my.png`, `--plan gpu-fp8-stream` (memory plans in `src/dotstories_engine/plan.py`).

## Local API (for the website)

```bash
uv run --extra ml dotstories-engine serve      # http://127.0.0.1:47761
```

| Call | What |
|---|---|
| `GET /info` | hardware, tier, time estimate |
| `POST /jobs` | start a dot (`prompt, style, seed, width, height, steps`) |
| `GET /jobs/<id>` | status: `queued → loading → running → done / error` + progress |
| `GET /jobs/<id>/image` | the PNG |

- Listens on `127.0.0.1` only.
- Only dotstories.com (and localhost dev) may call it: checked by the `Origin` header. Other websites get `403`.
- One dot at a time (`409` when busy). Every input field is validated.

## Models you already have

Before downloading, the engine looks for Krea 2 on your computer (read-only, never moved or changed):

| Where | What it reuses | Saves |
|---|---|---|
| Hugging Face cache (`~/.cache/huggingface`, `HF_HOME`) | the complete download | ~34 GB |
| ComfyUI: running instance, Desktop, portable, `extra_model_paths.yaml` | `krea2_turbo_bf16` / `krea2_turbo_fp8_scaled` | ~26 GB |

`info` shows what was found (`reuse.summary`) and a smaller download. If a found file won't load, it downloads instead.

## Sandbox

On by default for `generate` and `serve` (layer 1; the OS sandbox comes with the Tauri app):

- **Files:** writes only inside `~/.dotstories` and temp. Caches (Hugging Face, torch) are moved there.
- **While a dot runs:** no network (except 127.0.0.1), no new processes.
- **Models:** safetensors only. Pickle files can run code, so they are never loaded.
- Can't be switched off once on (Python audit hook). For debugging only: `DOTSTORIES_NO_SANDBOX=1`.

## Test

```bash
uv run pytest
```

Tests use a fake pipeline: no GPU or model download needed.
