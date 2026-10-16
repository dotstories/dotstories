"""dotstories-engine: `info` (what can this computer do?) and `generate` (make the image).

Every line printed is one JSON object, so the runner app can read it.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

from .estimate import estimate
from .progress import clock
from .hardware import detect, tier
from .plan import memory_plan

HOME = Path(os.environ.get("DOTSTORIES_HOME", Path.home() / ".dotstories"))


def start_sandbox():
    """On by default. DOTSTORIES_NO_SANDBOX=1 turns it off (debugging only)."""
    if os.environ.get("DOTSTORIES_NO_SANDBOX") != "1":
        from . import sandbox

        sandbox.install(HOME)


def emit(event: dict):
    print(json.dumps(event, ensure_ascii=False), flush=True)


_reuse = None


def reuse(refresh=False):
    """Models already on this computer. Scanned once, it takes a moment."""
    global _reuse
    if _reuse is None or refresh:
        from .models import scan

        _reuse = scan()
    return _reuse


def info() -> dict:
    hw = detect()
    t = tier(hw)
    r = reuse()
    return {"hardware": hw.to_dict(), "tier": t, "plan": memory_plan(hw),
            "estimate": estimate(t, r.saved_gb).to_dict(), "reuse": r.to_dict()}


def run_generate(dot: Path, out: Path, seed: int | None, plan: str | None):
    os.environ.setdefault("HF_HOME", str(HOME / "models"))  # all downloads in one place
    start_sandbox()
    from .access import use_token

    use_token()
    from .krea import generate, load_job, load_pipeline, make_generator
    from .sandbox import locked

    job = load_job(dot)
    if seed is not None:
        job.seed = seed
    status = info()
    plan = plan or status["plan"]
    emit({"event": "start", **status, "plan": plan})

    t0 = time.monotonic()
    emit({"event": "loading", "message": "Loading model (first run downloads it)"})
    pipe = load_pipeline(plan, reuse(), emit)
    emit({"event": "loaded", "seconds": round(time.monotonic() - t0, 1)})

    t1 = time.monotonic()
    with locked():
        path = generate(job, pipe, make_generator(job.seed), out, emit)
    emit({"event": "done", "path": str(path), "seed": job.seed, "seconds": round(time.monotonic() - t1, 1)})


def first_run_line(r, gb: float) -> str:
    """What the first load does: reuse, download, or both."""
    if r.snapshot:
        return "Model found on this computer: loading it into memory"
    if r.transformer:
        return (f"Reusing your ComfyUI file {r.transformer.name}. Still downloading the text encoder + VAE "
                f"(~{gb:.0f} GB) from Hugging Face, then loading it")
    return f"First run: downloading ~{gb:.0f} GB from Hugging Face, then loading it"


def model_runner():
    """Runs jobs for the local API. Keeps the model loaded between runs."""
    cache = {}

    def run(job, out, emit):
        from .krea import generate, load_pipeline, make_generator
        from .sandbox import locked

        from .access import use_token
        from .krea import MODEL
        from .progress import download_monitor

        status = info()
        plan = status["plan"]
        if plan not in cache:
            gb = status["estimate"]["download_gb"]
            emit({"event": "loading", "message": f"Getting {MODEL} ready ({status['hardware']['name']}, plan {plan})"})
            emit({"event": "log", "message": first_run_line(reuse(), gb)})
            use_token()  # gated models (Krea 2) download with the person's own token
            cache.clear()
            t0 = time.monotonic()
            folder = Path(os.environ["HF_HOME"]) / "hub" / f"models--{MODEL.replace('/', '--')}"
            with download_monitor(emit, folder, gb):
                cache[plan] = load_pipeline(plan, reuse(), emit)  # may download: network allowed here
            emit({"event": "log", "message": f"Model ready in {clock(time.monotonic() - t0)}"})
        with locked():  # no network, no new processes while the dot runs
            generate(job, cache[plan], make_generator(job.seed), out, emit)

    return run


def watch_parent(pid: int, alive=None, stop=lambda: os._exit(0), interval: float = 2.0):
    """The app started us: when the app is gone, stop too (no orphan GPU process)."""
    import psutil
    import threading

    alive = alive or psutil.pid_exists

    def loop():
        while alive(pid):
            time.sleep(interval)
        stop()

    t = threading.Thread(target=loop, daemon=True)
    t.start()
    return t


def on_disk(model: str) -> bool:
    """The complete model is on this computer (ours or Hugging Face's cache): no token needed.
    A ComfyUI file alone isn't enough: the text encoder and VAE still come from Hugging Face."""
    return bool(reuse().snapshot)


def serve(port: int):
    os.environ.setdefault("HF_HOME", str(HOME / "models"))
    if parent := os.environ.get("DOTSTORIES_PARENT_PID"):
        watch_parent(int(parent))
    start_sandbox()
    from functools import partial

    from . import access
    from .server import make_server

    status = info()
    srv = make_server(port, HOME / "output", model_runner(), info, access=partial(access.access, on_disk=on_disk))
    emit({
        "event": "serving",
        "url": f"http://127.0.0.1:{srv.server_address[1]}",
        "device": status["hardware"]["name"],
        "estimate": status["estimate"]["label"],
    })
    srv.serve_forever()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="dotstories-engine")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("info", help="hardware, tier and time estimate")
    g = sub.add_parser("generate", help="run a dot")
    g.add_argument("dot", type=Path, help="dot JSON file, e.g. examples/dark-fantasy.json")
    g.add_argument("--out", type=Path, default=HOME / "output" / "image.png")
    g.add_argument("--seed", type=int)
    g.add_argument("--plan", help="override the memory plan (see plan.py)")
    s = sub.add_parser("serve", help="local API for the website")
    s.add_argument("--port", type=int, default=47761)
    args = ap.parse_args(argv)

    if args.cmd == "info":
        emit(info())
        return 0
    if args.cmd == "serve":
        serve(args.port)
        return 0
    try:
        run_generate(args.dot, args.out, args.seed, args.plan)
        return 0
    except Exception as e:  # report, don't crash silently
        emit({"event": "error", "message": f"{type(e).__name__}: {e}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
