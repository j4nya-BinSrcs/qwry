from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"

    database_url: str = "sqlite:///./data/qwry.db"

    default_search_provider: str = "hybrid"
    searxng_enabled: bool = True
    searxng_base_url: str = "http://127.0.0.1:8080/"
    searxng_timeout_seconds: float = 5.0

    crawler_enabled: bool = True

    cors_allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


settings = Settings()
