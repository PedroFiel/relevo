"""Configuração via variáveis de ambiente (arquivo .env na raiz do repo)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ_REPO = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=RAIZ_REPO / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://relevo:relevo@localhost:5432/relevo"
    # Banco dos testes. Vazio = o mesmo servidor do DATABASE_URL, na base `relevo_test`.
    test_database_url: str | None = None
    storage_dir: Path = RAIZ_REPO / "storage"
    storage_tipo: str = "local"  # "local" ou "s3" (F4-T08)
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "relevo"
    s3_region: str = "us-east-1"
    jwt_secret: str = "relevo-segredo-desenvolvimento-local"
    jwt_validade_horas: int = 24 * 7
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
