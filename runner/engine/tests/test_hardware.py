from dotstories_engine.hardware import Hardware, tier


def test_rtx_4080_reports_slightly_under_16gb_and_is_still_16gb_tier():
    # A 4080 reports 15.99 GiB.
    assert tier(Hardware(device="cuda", name="RTX 4080", vram_gb=15.99, ram_gb=32)) == "nvidia-16"


def test_nvidia_tiers_by_vram():
    assert tier(Hardware("cuda", "RTX 4090", 24, 64)) == "nvidia-16"
    assert tier(Hardware("cuda", "RTX 3060", 12, 16)) == "nvidia-12"
    assert tier(Hardware("cuda", "RTX 4060", 8, 16)) == "nvidia-8"
    assert tier(Hardware("cuda", "GTX 1660", 6, 16)) == "nvidia-6"


def test_mac_tiers_by_unified_memory():
    assert tier(Hardware("mps", "Apple M4", 0, 16)) == "mac-16"
    assert tier(Hardware("mps", "Apple M1", 0, 8)) == "mac-8"


def test_cpu_tiers_by_ram():
    assert tier(Hardware("cpu", "Intel", 0, 32)) == "cpu-16"
    assert tier(Hardware("cpu", "Intel", 0, 8)) == "cpu-8"
