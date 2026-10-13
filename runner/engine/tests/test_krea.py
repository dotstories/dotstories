from pathlib import Path

from PIL import Image

from dotstories_engine.krea import Job, generate, load_job

EXAMPLE = Path(__file__).parents[1] / "examples" / "dark-fantasy.json"


class FakePipe:
    """Stands in for diffusers' Krea2Pipeline: records the call, fakes the steps."""

    def __init__(self):
        self.kwargs = None

    def __call__(self, **kwargs):
        self.kwargs = kwargs
        for step in range(kwargs["num_inference_steps"]):
            kwargs["callback_on_step_end"](self, step, None, {})

        class Out:
            images = [Image.new("RGB", (kwargs["width"], kwargs["height"]))]

        return Out()


def test_example_dot_loads():
    job = load_job(EXAMPLE)
    assert job.seed == 54460995
    assert job.steps == 8
    assert "stone hand" in job.prompt


def test_prompt_and_style_are_joined_like_the_kit():
    job = Job(prompt="A cave", style="dark fantasy", seed=1)
    assert job.full_prompt == "A cave. dark fantasy"


def test_generate_uses_turbo_settings_reports_progress_and_saves(tmp_path):
    pipe, events = FakePipe(), []
    out = generate(Job("A cave", "dark", seed=7, width=64, height=32), pipe, "gen", tmp_path / "x.png", events.append)

    assert pipe.kwargs["num_inference_steps"] == 8
    assert pipe.kwargs["guidance_scale"] == 0.0
    assert pipe.kwargs["generator"] == "gen"
    assert [e["step"] for e in events] == [1, 2, 3, 4, 5, 6, 7, 8]
    assert events[-1]["steps"] == 8
    assert Image.open(out).size == (64, 32)


def test_size_is_rounded_to_multiple_of_16():
    assert Job("p", "s", seed=1, width=1928, height=1085).size == (1920, 1088)
