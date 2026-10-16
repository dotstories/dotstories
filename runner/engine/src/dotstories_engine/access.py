"""Access to gated models on Hugging Face (e.g. Krea 2 Turbo).

A gated model needs, once per person: accept the model's terms on huggingface.co, and a
Hugging Face "Read" token. The token stays on this computer: the website sends it to this
app on 127.0.0.1, we save it where Hugging Face's own tools look (HF_HOME/token) and only
send it to huggingface.co.
"""
import os
import re
from pathlib import Path

# Only models a dot can use: the website can't make us ask Hugging Face about anything else.
GATED = {"krea/Krea-2-Turbo"}

TOKEN_RE = re.compile(r"^hf_[A-Za-z0-9]{20,100}$")


def hf_home() -> Path:
    return Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))


def token_path() -> Path:
    return hf_home() / "token"


def read_token() -> str | None:
    """Ours first, then a login the person already has (`hf auth login`, ComfyUI users)."""
    for path in (token_path(), Path.home() / ".cache" / "huggingface" / "token"):
        try:
            token = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if token:
            return token
    return os.environ.get("HF_TOKEN") or None


def save_token(token: str) -> None:
    if not isinstance(token, str) or not TOKEN_RE.fullmatch(token.strip()):
        raise ValueError("That doesn't look like a Hugging Face token (it starts with hf_)")
    path = token_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(token.strip(), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass  # Windows: the user's own profile folder already


def use_token() -> None:
    """Downloads use the saved token (Hugging Face reads HF_TOKEN)."""
    if token := read_token():
        os.environ["HF_TOKEN"] = token


def hub_check(model: str, token: str) -> str:
    """Ask Hugging Face. 'ok' | 'not-accepted' | 'bad-token' | 'offline'."""
    from huggingface_hub import auth_check
    from huggingface_hub.errors import GatedRepoError, HfHubHTTPError

    try:
        auth_check(model, token=token)
        return "ok"
    except GatedRepoError:
        return "not-accepted"
    except HfHubHTTPError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        return "bad-token" if status in (401, 403) else "offline"
    except OSError:
        return "offline"


def access(model: str, on_disk=lambda m: False, check=hub_check) -> dict:
    """Can this computer download `model`? Already downloaded = yes, no questions asked."""
    if model not in GATED:
        raise ValueError("unknown model")
    url = f"https://huggingface.co/{model}"
    if on_disk(model):
        return {"model": model, "status": "ok", "url": url}
    token = read_token()
    status = check(model, token) if token else "no-token"
    return {"model": model, "status": status, "url": url}


def is_access_error(e: Exception) -> bool:
    """A download failed because of the gate (no token, terms not accepted)."""
    name = type(e).__name__
    text = str(e)
    return name in ("GatedRepoError", "RepositoryNotFoundError") or "gated repo" in text.lower() or "401 Client Error" in text
