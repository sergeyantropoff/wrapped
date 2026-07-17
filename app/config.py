from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Wrapped"
    app_env: str = "development"
    app_secret_key: str = "change-me"
    app_base_url: str = "http://localhost:8000"
    log_level: str = "INFO"
    # Swagger / ReDoc / openapi.json. Default: on in development, off otherwise.
    docs_enabled: bool | None = None

    admin_username: str = "admin"
    admin_password: str = "38dmWjE1p"

    database_url: str = "postgresql+asyncpg://wrapped:wrapped@localhost:5432/wrapped"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "wrappedminio"
    s3_secret_key: str = "wrappedminio123"
    s3_bucket: str = "wrapped"
    s3_region: str = "us-east-1"
    s3_use_ssl: bool = False
    s3_create_bucket: bool = True

    turnstile_secret_key: str = ""
    hcaptcha_secret_key: str = ""

    session_cookie_name: str = "wrapped_admin"
    session_max_age: int = 60 * 60 * 12

    # Comma-separated IPs/CIDRs allowed to set X-Forwarded-For / X-Real-IP.
    # Use * to trust any peer (recommended in k8s when only Ingress reaches the pod).
    # Default: loopback + RFC1918 + Docker Desktop gateway range.
    trusted_proxies: str = (
        "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,192.168.65.0/24"
    )

    @property
    def is_docs_enabled(self) -> bool:
        if self.docs_enabled is not None:
            return self.docs_enabled
        return self.app_env.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
