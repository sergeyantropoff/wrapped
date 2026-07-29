from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.openapi.utils import get_openapi
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api import admin, wraps
from app.config import get_settings
from app.db import SessionLocal
from app.services.settings_service import get_or_create_settings
from app.services.storage import storage
from app.static_url import static_url
from app.version import get_app_version, get_app_version_label

OPENAPI_TAGS = [
    {
        "name": "System",
        "description": "Service health and runtime checks.",
    },
    {
        "name": "Public",
        "description": "Anonymous client configuration (limits, captcha, password mode).",
    },
    {
        "name": "Wraps",
        "description": "Zero-knowledge create / one-time unwrap of encrypted packages.",
    },
    {
        "name": "Admin",
        "description": "Protected admin JSON API. Authorize with HTTP Basic (admin username/password from env).",
    },
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await storage.ensure_bucket()
    async with SessionLocal() as db:
        await get_or_create_settings(db)
    yield


def custom_openapi(app: FastAPI):
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=OPENAPI_TAGS,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})
    schema["components"]["securitySchemes"]["HTTPBasic"] = {
        "type": "http",
        "scheme": "basic",
        "description": "Admin username and password from environment (ADMIN_USERNAME / ADMIN_PASSWORD).",
    }
    # Mark Admin-tagged operations as secured
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            if "Admin" in (operation.get("tags") or []):
                operation["security"] = [{"HTTPBasic": []}]
    app.openapi_schema = schema
    return app.openapi_schema


def create_app() -> FastAPI:
    settings = get_settings()
    docs_on = settings.is_docs_enabled
    app_version = get_app_version()
    app = FastAPI(
        title=settings.app_name,
        version=app_version,
        description=(
            "Wrapped — zero-knowledge one-time encrypted drop.\n\n"
            "Public wrap APIs are anonymous. Admin APIs require HTTP Basic."
        ),
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS if docs_on else None,
        docs_url="/docs" if docs_on else None,
        redoc_url="/redoc" if docs_on else None,
        openapi_url="/openapi.json" if docs_on else None,
    )

    # Honor X-Forwarded-For / X-Real-IP from ingress / reverse proxies.
    trusted = (settings.trusted_proxies or "").strip() or "*"
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=trusted)

    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    app.include_router(wraps.router)
    app.include_router(admin.router)
    app.include_router(admin.api_router)

    templates = Jinja2Templates(directory="app/templates")
    # Callables so Jinja re-reads VERSION (dev mount / after bump) on each render
    templates.env.globals["app_version"] = get_app_version
    templates.env.globals["app_version_label"] = get_app_version_label
    templates.env.globals["static_url"] = static_url
    admin.templates.env.globals["app_version"] = get_app_version
    admin.templates.env.globals["app_version_label"] = get_app_version_label
    admin.templates.env.globals["static_url"] = static_url

    @app.get("/health", tags=["System"], summary="Health check", include_in_schema=docs_on)
    async def health():
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": get_app_version(),
        }

    @app.get("/", include_in_schema=False)
    async def index(request: Request):
        return templates.TemplateResponse(
            request,
            "create.html",
            {"title": "Wrapped", "page": "create"},
        )

    @app.get("/w/{wrap_id}", include_in_schema=False)
    async def unwrap_page(request: Request, wrap_id: str):
        return templates.TemplateResponse(
            request,
            "unwrap.html",
            {"title": "Unwrap", "page": "unwrap", "wrap_id": wrap_id},
        )

    @app.get("/unwrap", include_in_schema=False)
    async def unwrap_token_page(request: Request):
        return templates.TemplateResponse(
            request,
            "unwrap.html",
            {"title": "Unwrap", "page": "unwrap", "wrap_id": ""},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if (
            exc.status_code == 401
            and request.url.path.startswith("/admin")
            and not request.url.path.startswith("/admin/api")
        ):
            return RedirectResponse("/admin/login", status_code=302)
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )

    if docs_on:
        app.openapi = lambda: custom_openapi(app)
    return app


app = create_app()
