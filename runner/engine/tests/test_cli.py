import json

from dotstories_engine import cli
from dotstories_engine.hardware import Hardware


def test_info_prints_hardware_tier_and_estimate(monkeypatch, capsys):
    monkeypatch.setattr(cli, "detect", lambda: Hardware("cuda", "RTX 4080", 15.99, 32))
    assert cli.main(["info"]) == 0

    out = json.loads(capsys.readouterr().out)
    assert out["tier"] == "nvidia-16"
    assert out["plan"] == "gpu-fp8-offload"
    assert out["estimate"]["label"] == "~5–15 seconds"
    assert out["hardware"]["name"] == "RTX 4080"


def test_stops_when_the_app_is_gone():
    import threading

    stopped = threading.Event()
    checks = iter([True, True, False])  # app alive, alive, gone
    t = cli.watch_parent(123, alive=lambda pid: next(checks), stop=stopped.set, interval=0.01)
    t.join(2)
    assert stopped.is_set()
