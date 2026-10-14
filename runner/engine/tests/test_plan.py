from dotstories_engine.hardware import Hardware
from dotstories_engine.plan import memory_plan


def test_big_gpu_keeps_everything_on_gpu():
    assert memory_plan(Hardware("cuda", "RTX 5090", 32, 64)) == "gpu-bf16"


def test_16gb_gpu_stores_weights_in_fp8_and_offloads_the_rest():
    assert memory_plan(Hardware("cuda", "RTX 4080", 15.99, 32)) == "gpu-fp8-offload"


def test_small_gpu_streams_blocks():
    assert memory_plan(Hardware("cuda", "RTX 4060", 8, 16)) == "gpu-fp8-stream"


def test_mac_and_cpu():
    assert memory_plan(Hardware("mps", "Apple M4", 0, 16)) == "mps-bf16"
    assert memory_plan(Hardware("cpu", "Intel", 0, 32)) == "cpu-fp8"
