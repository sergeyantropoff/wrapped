from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.responses import Response

from app.config import get_settings

http_basic = HTTPBasic(auto_error=False)


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.app_secret_key, salt="wrapped-admin")


def create_session_token(username: str) -> str:
    return _serializer().dumps({"u": username})


def read_session_token(token: str, max_age: int) -> str | None:
    try:
        data = _serializer().loads(token, max_age=max_age)
        return data.get("u")
    except (BadSignature, SignatureExpired, Exception):
        return None


def set_admin_cookie(response: Response, username: str) -> None:
    settings = get_settings()
    token = create_session_token(username)
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age,
        secure=settings.app_env == "production",
        path="/",
    )


def clear_admin_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")


def get_admin_user(request: Request) -> str | None:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    return read_session_token(token, settings.session_max_age)


def _basic_ok(credentials: HTTPBasicCredentials) -> bool:
    settings = get_settings()
    user_ok = secrets.compare_digest(credentials.username, settings.admin_username)
    pass_ok = secrets.compare_digest(credentials.password, settings.admin_password)
    return user_ok and pass_ok


async def require_admin_web(request: Request) -> str:
    """Cookie-only auth for HTML admin pages (redirect via exception handler)."""
    cookie_user = get_admin_user(request)
    if cookie_user:
        return cookie_user
    raise HTTPException(status_code=401, detail="unauthorized")


async def require_admin_api(
    request: Request,
    credentials: Annotated[HTTPBasicCredentials | None, Depends(http_basic)] = None,
) -> str:
    """Cookie or HTTP Basic — for JSON admin API / Swagger."""
    cookie_user = get_admin_user(request)
    if cookie_user:
        return cookie_user
    if credentials and _basic_ok(credentials):
        return credentials.username
    raise HTTPException(
        status_code=401,
        detail="unauthorized",
        headers={"WWW-Authenticate": "Basic"},
    )


AdminWebAuth = Annotated[str, Depends(require_admin_web)]
AdminAuth = Annotated[str, Depends(require_admin_api)]
