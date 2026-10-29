"""Conexão com o PostgreSQL (SQLAlchemy 2)."""

from collections.abc import Callable, Iterator

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from relevo_api.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Nomes fixos para índices e restrições: as migrações ficam iguais em qualquer máquina e o
# `downgrade` consegue apagar cada restrição pelo nome.
CONVENCAO_NOMES = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base dos modelos ORM (tabelas em relevo_api/models.py, ver docs/04-banco-de-dados.md)."""

    metadata = MetaData(naming_convention=CONVENCAO_NOMES)


def get_db() -> Iterator[Session]:
    with SessionLocal() as sessao:
        yield sessao


def get_fabrica_sessao() -> Callable[[], Session]:
    """Fábrica de sessões para o que roda fora da requisição (o job em segundo plano e o
    *startup*). Nos testes vira uma fábrica presa à transação desfeita do teste [F3-T04]."""
    return SessionLocal


def banco_disponivel() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
