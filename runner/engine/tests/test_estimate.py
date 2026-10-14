from dotstories_engine.estimate import estimate


def test_fast_gpu_estimate_is_seconds():
    e = estimate("nvidia-16")
    assert e.run_seconds == (5, 15)
    assert e.warning is None


def test_cpu_estimate_is_long_with_a_clear_message():
    e = estimate("cpu-16")
    assert e.run_seconds == (30 * 60, 90 * 60)
    assert "no GPU" in e.label


def test_low_memory_pc_still_runs_but_warns():
    e = estimate("cpu-8")
    assert e.warning is not None


def test_first_run_download_uses_1gb_per_minute():
    e = estimate("nvidia-16")
    assert e.download_minutes == round(e.download_gb)


def test_label_is_short_and_human():
    assert estimate("nvidia-16").label == "~5–15 seconds"
    assert estimate("mac-16").label == "~1–6 minutes"
