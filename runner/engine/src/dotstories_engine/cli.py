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
from .hardware import detect, tier
from .plan import memory_plan

HOME = Path(os.environ.get("DOTSTORIES_HOME", Path.home() / ".dotstories"))


def emit(event: dict):
    print(json.dumps(event, ensure_ascii=False), flush=True)


def info() -> dict:
    hw = detect()
    t = tier(hw)
    return {"hardware": hw.to_dict(), "tier": t, "plan": memory_plan(hw), "estimate": estimate(t).to_dict()}


def run_generate(dot: Path, out: Path, seed: int | None, plan: str | None):
    os.environ.setdefault("HF_HOME", str(HOME / "models"))  # all downloads in one place
    from .krea import generate, load_job, load_pipeline, make_generator

    job = load_job(dot)
    if seed is not None:
        job.seed = seed
    status = info()
    plan = plan or status["plan"]
    emit({"event": "start", **status, "plan": plan})

    t0 = time.monotonic()
    emit({"event": "loading", "message": "Loading model (first run downloads it)"})
    pipe = load_pipeline(plan)
    emit({"event": "loaded", "seconds": round(time.monotonic() - t0, 1)})

    t1 = time.monotonic()
    path = generate(job, pipe, make_generator(job.seed), out, emit)
    emit({"event": "done", "path": str(path), "seed": job.seed, "seconds": round(time.monotonic() - t1, 1)})


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="dotstories-engine")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("info", help="hardware, tier and time estimate")
    g = sub.add_parser("generate", help="run a dot")
    g.add_argument("dot", type=Path, help="dot JSON file, e.g. examples/dark-fantasy.json")
    g.add_argument("--out", type=Path, default=HOME / "output" / "image.png")
    g.add_argument("--seed", type=int)
    g.add_argument("--plan", help="override the memory plan (see plan.py)")
    args = ap.parse_args(argv)

    if args.cmd == "info":
        emit(info())
        return 0
    try:
        run_generate(args.dot, args.out, args.seed, args.plan)
        return 0
    except Exception as e:  # report, don't crash silently
        emit({"event": "error", "message": f"{type(e).__name__}: {e}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
