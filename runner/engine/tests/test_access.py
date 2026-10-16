import pytest

from dotstories_engine import access as hf

MODEL = "krea/Krea-2-Turbo"
TOKEN = "hf_" + "a" * 34


@pytest.fixture(autouse=True)
def home(tmp_path, monkeypatch):
    """A fresh computer: our HF_HOME and the person's home folder are empty."""
    monkeypatch.setenv("HF_HOME", str(tmp_path / "models"))
    monkeypatch.setattr(hf.Path, "home", lambda: tmp_path / "user")
    monkeypatch.delenv("HF_TOKEN", raising=False)
    return tmp_path


def test_no_token_yet():
    assert hf.access(MODEL, check=pytest.fail) == {
        "model": MODEL,
        "status": "no-token",
        "url": "https://huggingface.co/krea/Krea-2-Turbo",
    }


def test_already_downloaded_needs_nothing():
    assert hf.access(MODEL, on_disk=lambda m: True, check=pytest.fail)["status"] == "ok"


def test_saved_token_is_checked_with_hugging_face():
    hf.save_token(TOKEN)
    asked = []
    status = hf.access(MODEL, check=lambda m, t: asked.append((m, t)) or "not-accepted")["status"]
    assert status == "not-accepted"
    assert asked == [(MODEL, TOKEN)]
    assert hf.token_path().read_text() == TOKEN


def test_uses_an_existing_hugging_face_login(home):
    login = home / "user" / ".cache" / "huggingface" / "token"
    login.parent.mkdir(parents=True)
    login.write_text(TOKEN + "\n")
    assert hf.read_token() == TOKEN


@pytest.mark.parametrize("bad", ["", "abc", "hf_short", "hf_" + "a" * 34 + "\n; rm -rf", None, 42])
def test_rejects_things_that_are_not_tokens(bad):
    with pytest.raises(ValueError):
        hf.save_token(bad)
    assert not hf.token_path().exists()


def test_only_known_models():
    with pytest.raises(ValueError):
        hf.access("someone/else", check=pytest.fail)


def test_downloads_use_the_saved_token(monkeypatch):
    monkeypatch.setenv("HF_TOKEN", "old")  # restored after the test
    hf.save_token(TOKEN)
    hf.use_token()
    assert hf.os.environ["HF_TOKEN"] == TOKEN


@pytest.mark.parametrize(
    "error, gated",
    [
        (type("GatedRepoError", (Exception,), {})("401 Client Error. Cannot access gated repo"), True),
        (RuntimeError("401 Client Error: Unauthorized"), True),
        (RuntimeError("CUDA out of memory"), False),
    ],
)
def test_knows_gate_errors(error, gated):
    assert hf.is_access_error(error) is gated
