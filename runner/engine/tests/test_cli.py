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
