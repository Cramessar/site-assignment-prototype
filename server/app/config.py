from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)
    app_name: str = "Site Assignment API"
    database_url: str = "postgresql+psycopg://site_assignment:site_assignment@db:5432/site_assignment"
    auth_mode: str = "dev"
    dev_user_email: str = "supervisor@example.com"
    identity_header: str = "x-user-email"
    bootstrap_admins: str = ""
    bootstrap_supervisors: str = "supervisor@example.com"
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080"

    @staticmethod
    def _csv(value: str) -> list[str]:
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    @property
    def admin_emails(self) -> set[str]:
        return set(self._csv(self.bootstrap_admins))

    @property
    def supervisor_emails(self) -> set[str]:
        return set(self._csv(self.bootstrap_supervisors))

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
