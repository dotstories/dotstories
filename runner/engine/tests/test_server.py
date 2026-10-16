import json
import threading
import time
import urllib.error
import urllib.request

import pytest
from PIL import Image

from dotstories_engine.hardware import Hardware
from dotstories_engine.server import make_server

SITE = "https://dotstories.com"
JOB = {"prompt": "A cave", "style": "dark", "seed": 7, "width": 64, "height": 64, "steps": 3}


def fake_run(job, out, emit):
    """Stands in for the model: reports steps, writes an image."""
    emit({"event": "loading"})
    for step in range(1, job.steps + 1):
        emit({"event": "progress", "step": step, "steps": job.steps, "eta": 0})
    Image.new("RGB", job.size).save(out)


@pytest.fixture
def server(tmp_path):
    srv = make_server(
        port=0,
        out_dir=tmp_path,
        run=fake_run,
        info=lambda: {"hardware": Hardware("cuda", "RTX 4080", 16, 32).to_dict(), "tier": "nvidia-16"},
    )
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def call(url, method="GET", body=None, origin=SITE):
    headers = {"Content-Type": "application/json"}
    if origin:
        headers["Origin"] = origin
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def wait_done(base, job_id):
    for _ in range(100):
        _, _, body = call(f"{base}/jobs/{job_id}")
        job = json.loads(body)
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def test_health_and_info(server):
    status, headers, body = call(f"{server}/info")
    assert status == 200
    assert json.loads(body)["tier"] == "nvidia-16"
    assert headers["Access-Control-Allow-Origin"] == SITE


def test_other_websites_are_blocked(server):
    status, _, _ = call(f"{server}/info", origin="https://evil.example")
    assert status == 403
    status, _, _ = call(f"{server}/jobs", "POST", JOB, origin="https://evil.example")
    assert status == 403


def test_starting_a_job_needs_an_origin(server):
    status, _, _ = call(f"{server}/jobs", "POST", JOB, origin=None)
    assert status == 403


def test_preflight_allows_private_network_access(server):
    status, headers, _ = call(f"{server}/jobs", "OPTIONS")
    assert status == 204
    assert headers["Access-Control-Allow-Private-Network"] == "true"
    assert "POST" in headers["Access-Control-Allow-Methods"]


def test_run_a_job_end_to_end(server):
    status, _, body = call(f"{server}/jobs", "POST", JOB)
    assert status == 202
    job_id = json.loads(body)["id"]

    job = wait_done(server, job_id)
    assert job["status"] == "done"
    assert job["progress"] == {"step": 3, "steps": 3, "eta": 0}

    status, headers, png = call(f"{server}/jobs/{job_id}/image")
    assert status == 200
    assert headers["Content-Type"] == "image/png"
    assert png[:8] == b"\x89PNG\r\n\x1a\n"


def test_bad_input_is_rejected(server):
    for bad in [{**JOB, "width": 99999}, {**JOB, "steps": 0}, {**JOB, "prompt": ""}, {"seed": 1}]:
        status, _, body = call(f"{server}/jobs", "POST", bad)
        assert status == 400, bad
        assert "error" in json.loads(body)


def test_errors_are_reported_on_the_job(tmp_path):
    def broken(job, out, emit):
        raise RuntimeError("CUDA out of memory")

    srv = make_server(port=0, out_dir=tmp_path, run=broken, info=dict)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    _, _, body = call(f"{base}/jobs", "POST", JOB)
    job = wait_done(base, json.loads(body)["id"])
    srv.shutdown()
    assert job["status"] == "error"
    assert "out of memory" in job["error"]


def test_unknown_job_is_404(server):
    assert call(f"{server}/jobs/nope")[0] == 404


def test_only_one_dot_runs_at_a_time(tmp_path):
    release = threading.Event()

    def slow(job, out, emit):
        release.wait(5)
        Image.new("RGB", job.size).save(out)

    srv = make_server(port=0, out_dir=tmp_path, run=slow, info=dict)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    assert call(f"{base}/jobs", "POST", JOB)[0] == 202
    assert call(f"{base}/jobs", "POST", JOB)[0] == 409
    release.set()
    srv.shutdown()


# ---------- gated models (Hugging Face access) ----------

TOKEN = "hf_" + "b" * 34


@pytest.fixture
def gated(tmp_path):
    """Access answers from a fake Hugging Face; tokens saved in a list."""
    saved = []

    def access(model):
        if model != "krea/Krea-2-Turbo":
            raise ValueError("unknown model")
        return {"model": model, "status": "ok" if saved else "no-token", "url": f"https://huggingface.co/{model}"}

    def save_token(token):
        if not isinstance(token, str) or not token.startswith("hf_"):
            raise ValueError("That doesn't look like a Hugging Face token")
        saved.append(token)

    srv = make_server(port=0, out_dir=tmp_path, run=fake_run, info=dict, access=access, save_token=save_token)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", saved
    srv.shutdown()


def test_access_says_what_is_missing(gated):
    base, _ = gated
    status, _, body = call(f"{base}/access?model=krea/Krea-2-Turbo")
    assert status == 200
    assert json.loads(body)["status"] == "no-token"
    assert call(f"{base}/access?model=someone/else")[0] == 400


def test_save_token_then_access_is_ok(gated):
    base, saved = gated
    status, _, body = call(f"{base}/hf-token", "POST", {"model": "krea/Krea-2-Turbo", "token": TOKEN})
    assert status == 200
    assert json.loads(body)["status"] == "ok"
    assert saved == [TOKEN]


def test_token_needs_the_site_and_a_real_token(gated):
    base, saved = gated
    assert call(f"{base}/hf-token", "POST", {"model": "krea/Krea-2-Turbo", "token": TOKEN}, origin=None)[0] == 403
    assert call(f"{base}/hf-token", "POST", {"model": "krea/Krea-2-Turbo", "token": TOKEN}, origin="https://evil.example")[0] == 403
    assert call(f"{base}/hf-token", "POST", {"model": "krea/Krea-2-Turbo", "token": "nope"})[0] == 400
    assert call(f"{base}/hf-token", "POST", {"model": "someone/else", "token": TOKEN})[0] == 400
    assert saved == []


def test_gate_errors_are_marked_on_the_job(tmp_path):
    def gated_download(job, out, emit):
        raise type("GatedRepoError", (Exception,), {})("401 Client Error. Cannot access gated repo")

    srv = make_server(port=0, out_dir=tmp_path, run=gated_download, info=dict)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    _, _, body = call(f"{base}/jobs", "POST", JOB)
    job = wait_done(base, json.loads(body)["id"])
    srv.shutdown()
    assert job["status"] == "error"
    assert job["code"] == "model-access"


def test_job_log_lines_come_in_order_and_only_new_ones(server):
    _, _, body = call(f"{server}/jobs", "POST", JOB)
    job_id = json.loads(body)["id"]
    job = wait_done(server, job_id)
    texts = [line["text"] for line in job["log"]["lines"]]
    assert texts[0] == "Starting"
    assert "Making the image: step 3 of 3" in texts
    assert texts[-1].startswith("Done in")
    assert job["message"] == texts[-1]
    assert [line["n"] for line in job["log"]["lines"]] == list(range(len(texts)))

    nxt = job["log"]["next"]
    _, _, body = call(f"{server}/jobs/{job_id}?since={nxt - 1}")
    assert [line["text"] for line in json.loads(body)["log"]["lines"]] == texts[-1:]
