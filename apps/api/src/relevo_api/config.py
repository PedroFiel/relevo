"""Configuração via variáveis de ambiente (arquivo .env na raiz do repo)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ_REPO = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=RAIZ_REPO / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://relevo:relevo@localhost:5432/relevo"
    storage_dir: Path = RAIZ_REPO / "storage"
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
