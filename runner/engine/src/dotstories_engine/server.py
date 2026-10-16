"""Local API the website talks to. Listens on 127.0.0.1 only.

GET  /info              hardware, tier, estimate
POST /jobs              start a dot run -> {"id": ...}
GET  /jobs/<id>?since=N status + progress + new log lines
GET  /jobs/<id>/image   the result (PNG)
GET  /access?model=     may this computer download a gated model? (see access.py)
POST /hf-token          save the person's Hugging Face token on this computer -> access

Only the DotStories website may call it (checked by the browser's Origin header).
"""
import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import access as hf
from .krea import Job

PORT = 47761
ALLOWED_ORIGINS = {
    "https://dotstories.com",
    "https://www.dotstories.com",
    "https://dotstories.dayonel.workers.dev",
    "http://localhost:3000",
    "http://localhost:8787",
    *filter(None, os.environ.get("DOTSTORIES_ALLOWED_ORIGINS", "").split(",")),
}


class BadJob(ValueError):
    pass


def parse_job(d) -> Job:
    """Never trust input from the network: check every field."""
    if not isinstance(d, dict):
        raise BadJob("body must be a JSON object")

    def text(key, max_len):
        v = d.get(key)
        if not isinstance(v, str) or not v.strip() or len(v) > max_len:
            raise BadJob(f"{key}: 1–{max_len} characters")
        return v

    def number(key, lo, hi, default=None):
        v = d.get(key, default)
        if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
            raise BadJob(f"{key}: whole number {lo}–{hi}")
        return v

    return Job(
        prompt=text("prompt", 4000),
        style=text("style", 4000),
        seed=number("seed", 0, 2**32 - 1),
        width=number("width", 64, 2048, 1920),
        height=number("height", 64, 2048, 1088),
        steps=number("steps", 1, 50, 8),
    )


MAX_LOG = 2000


class Jobs:
    """One job at a time: the GPU can only do one."""

    def __init__(self, out_dir: Path, run):
        self.out_dir, self.run = Path(out_dir), run
        self.jobs: dict[str, dict] = {}
        self.lock = threading.Lock()

    def busy(self):
        return any(j["status"] in ("queued", "loading", "running") for j in self.jobs.values())

    def start(self, job: Job) -> str | None:
        with self.lock:
            if self.busy():
                return None
            job_id = uuid.uuid4().hex[:12]
            self.jobs[job_id] = {"id": job_id, "status": "queued", "progress": None, "error": None,
                                 "message": "Starting", "log": []}
        threading.Thread(target=self._work, args=(job_id, job), daemon=True).start()
        return job_id

    def _work(self, job_id, job):
        state = self.jobs[job_id]
        out = self.out_dir / f"{job_id}.png"
        t0 = time.monotonic()

        def log(text):
            """One line in the live log on the website (and the short status next to Run)."""
            lines = state["log"]
            n = lines[-1]["n"] + 1 if lines else 0
            lines.append({"n": n, "t": round(time.monotonic() - t0, 1), "text": text})
            del lines[:-MAX_LOG]
            state["message"] = text

        def emit(e):
            event = e.get("event")
            if event == "loading":
                state["status"] = "loading"
                log(e.get("message") or "Loading the model")
            elif event == "progress":
                state["status"] = "running"
                state["progress"] = {k: e[k] for k in ("step", "steps", "eta")}
                log(f"Making the image: step {e['step']} of {e['steps']}")
            elif event in ("log", "warning") and e.get("message"):
                log(("Warning: " if event == "warning" else "") + e["message"])

        log("Starting")
        try:
            self.out_dir.mkdir(parents=True, exist_ok=True)
            self.run(job, out, emit)
            state["image"] = out
            log(f"Done in {round(time.monotonic() - t0)} s")
            state["status"] = "done"
        except Exception as e:
            state["error"] = f"{type(e).__name__}: {e}"
            if hf.is_access_error(e):
                state["code"] = "model-access"  # the website shows how to get access
            log(f"Error: {state['error']}")
            state["status"] = "error"

    def public(self, job_id, since=0):
        """The job for the website: only log lines numbered `since` and up (new ones)."""
        j = self.jobs.get(job_id)
        if j is None:
            return None
        lines = [line for line in j["log"] if line["n"] >= since]
        nxt = j["log"][-1]["n"] + 1 if j["log"] else 0
        return {**{k: v for k, v in j.items() if k not in ("image", "log")}, "log": {"next": nxt, "lines": lines}}


def make_server(port: int, out_dir: Path, run, info, access=hf.access, save_token=hf.save_token) -> ThreadingHTTPServer:
    jobs = Jobs(out_dir, run)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # quiet; the runner app shows status instead
            pass

        def origin_ok(self, required=False):
            origin = self.headers.get("Origin")
            if origin is None:
                return not required  # local tools (curl) may read, never start jobs
            return origin in ALLOWED_ORIGINS

        def send(self, status, body=None, content_type="application/json"):
            data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else b""
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            if data:
                self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):  # CORS + Chrome private network preflight
            if not self.origin_ok(required=True):
                return self.send(403, {"error": "origin not allowed"})
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if not self.origin_ok():
                return self.send(403, {"error": "origin not allowed"})
            url = urlparse(self.path)
            parts = url.path.strip("/").split("/")
            if parts == ["access"]:
                model = parse_qs(url.query).get("model", [""])[0]
                try:
                    return self.send(200, access(model))
                except ValueError as e:
                    return self.send(400, {"error": str(e)})
            if parts == ["health"]:
                return self.send(200, {"ok": True})
            if parts == ["info"]:
                return self.send(200, info())
            if len(parts) in (2, 3) and parts[0] == "jobs":
                try:
                    since = max(0, int(parse_qs(url.query).get("since", ["0"])[0]))
                except ValueError:
                    since = 0
                job = jobs.public(parts[1], since)
                if job is None:
                    return self.send(404, {"error": "no such job"})
                if len(parts) == 2:
                    return self.send(200, job)
                if parts[2] == "image" and job["status"] == "done":
                    return self.send(200, Path(jobs.jobs[parts[1]]["image"]).read_bytes(), "image/png")
            return self.send(404, {"error": "not found"})

        def do_POST(self):
            if not self.origin_ok(required=True):
                return self.send(403, {"error": "origin not allowed"})
            if self.path == "/hf-token":
                return self.hf_token()
            if self.path != "/jobs":
                return self.send(404, {"error": "not found"})
            try:
                length = min(int(self.headers.get("Content-Length", 0)), 64_000)
                job = parse_job(json.loads(self.rfile.read(length) or b"null"))
            except (BadJob, json.JSONDecodeError, ValueError) as e:
                return self.send(400, {"error": str(e)})
            job_id = jobs.start(job)
            if job_id is None:
                return self.send(409, {"error": "a dot is already running"})
            return self.send(202, {"id": job_id})

        def hf_token(self):
            """Save the token, then check it against the model: the answer says what's still missing."""
            try:
                length = min(int(self.headers.get("Content-Length", 0)), 4_000)
                body = json.loads(self.rfile.read(length) or b"null")
                if not isinstance(body, dict):
                    raise ValueError("body must be a JSON object")
                model = body.get("model", "")
                if model not in hf.GATED:
                    raise ValueError("unknown model")
                save_token(body.get("token"))
            except (ValueError, json.JSONDecodeError) as e:
                return self.send(400, {"error": str(e)})
            return self.send(200, access(model))

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)
