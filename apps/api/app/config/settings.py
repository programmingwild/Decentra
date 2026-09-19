from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings

DEFAULT_SECRET = "change-me-to-a-strong-random-secret-at-least-32-chars"

class Settings(BaseSettings):
    app_env: str = "development"  # development | production
    database_url: str = "sqlite+aiosqlite:///./decentra.db"
    secret_key: str = DEFAULT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"  # Groq retired llama-3.3-70b-versatile on 2026-08-16
    ai_provider: str = "local"  # local | openai | groq
    tavily_api_key: str = ""
    privacy_mode: str = "BALANCED"  # MAXIMUM/BALANCED/RESEARCH
    storage_path: str = "./storage"
    cors_origins: str = "http://localhost:3000"
    trusted_hosts: str = "*"  # comma-separated; enforced only in production
    open_registration: bool = True  # false = demo/single-user instance, only seeded accounts can sign in
    cookie_samesite: str = "lax"  # lax | strict | none (none = split-domain deploys, requires https)
    docs_enabled: bool = True  # set false to hide /docs, /redoc, /openapi.json
    max_upload_mb: int = 50  # dataset files (CSV/XLSX)
    max_recording_mb: int = 200  # meeting recordings (audio/video)
    log_level: str = "INFO"
    # realtime: answer cache (per scope+question, fingerprint-invalidated, TTL backstop)
    assistant_cache_ttl_seconds: int = 3600  # datasets change rarely
    meetings_cache_ttl_seconds: int = 900  # org data changes often
    # realtime: LLM resilience (Groq free tier queues + rate limits)
    llm_timeout_seconds: int = 25
    llm_max_retries: int = 3
    llm_retry_base_seconds: float = 1.0
    # realtime: shared rate-limit state across uvicorn workers (empty = per-process memory)
    rate_limit_storage_uri: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()] or ["*"]

    @model_validator(mode="after")
    def _refuse_default_secret_in_production(self):
        if self.is_production and self.secret_key == DEFAULT_SECRET:
            raise ValueError(
                "SECRET_KEY must be changed before running with APP_ENV=production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
