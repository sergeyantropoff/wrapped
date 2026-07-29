from __future__ import annotations

from pathlib import Path

from app.version import get_app_version

_STATIC_ROOT = Path(__file__).resolve().parent / "static"


def static_url(path: str) -> str:
    """URL for a file under app/static with cache-busting query (?v=...).

    Stamp = app version + file mtime so CSS/JS updates apply even when VERSION
    is unchanged (compose bind-mount / same-tag redeploy).
    """
    rel = path.lstrip("/")
    if rel.startswith("static/"):
        rel = rel[len("static/") :]
    stamp = get_app_version()
    try:
        mtime = int((_STATIC_ROOT / rel).stat().st_mtime)
        stamp = f"{stamp}.{mtime}"
    except OSError:
        pass
    return f"/static/{rel}?v={stamp}"
