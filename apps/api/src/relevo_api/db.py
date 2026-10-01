"""Conexão com o PostgreSQL (SQLAlchemy 2)."""

from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from relevo_api.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base dos modelos ORM. As tabelas são criadas na Fase 3 (ver docs/04-banco-de-dados.md)."""


def get_db() -> Iterator[Session]:
    with SessionLocal() as sessao:
        yield sessao


def banco_disponivel() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
