"""Banco de teste: base `relevo_test` no mesmo servidor do DATABASE_URL (ou TEST_DATABASE_URL).

Uma vez por sessão a base é criada (se faltar) e recebe `alembic upgrade head`; cada teste roda
dentro de uma transação desfeita no fim, então nada sobra entre um teste e outro.
Sem servidor alcançável os testes de banco são pulados — a não ser que TEST_DATABASE_URL tenha sido
definida (o CI define), aí a falha de conexão é erro.

Testes de rota usam a fixture `cliente`: o `TestClient` da API com `get_db` trocado pela sessão `db`
(mesma transação desfeita) e `get_storage` por um `LocalStorage` em `tmp_path` [F3-T04].
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from relevo_api.config import settings
from relevo_api.db import get_db
from relevo_api.main import app
from relevo_api.storage import LocalStorage, get_storage
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

BASE_TESTE = "relevo_test"
PASTA_MIGRACOES = Path(__file__).resolve().parents[1] / "migrations"


def url_teste() -> str:
    if settings.test_database_url:
        return settings.test_database_url
    return make_url(settings.database_url).set(database=BASE_TESTE).render_as_string(False)


def criar_base_se_faltar(url: str) -> None:
    alvo = make_url(url)
    # CREATE DATABASE não roda dentro de transação: conecta na base padrão em AUTOCOMMIT
    servidor = create_engine(alvo.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with servidor.connect() as conn:
            existe = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :nome"), {"nome": alvo.database}
            ).scalar()
            if not existe:
                conn.execute(text(f'CREATE DATABASE "{alvo.database}"'))
    finally:
        servidor.dispose()


def migrar(engine: Engine, revisao: str = "head", descer: bool = False) -> None:
    # Sem o alembic.ini: ele reconfiguraria o logging do pytest. Só precisa achar as migrações.
    cfg = Config()
    cfg.set_main_option("script_location", str(PASTA_MIGRACOES))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        if descer:
            command.downgrade(cfg, revisao)
        else:
            command.upgrade(cfg, revisao)


@pytest.fixture(scope="session")
def engine_teste() -> Iterator[Engine]:
    url = url_teste()
    try:
        criar_base_se_faltar(url)
    except OperationalError as e:
        if settings.test_database_url:
            raise
        pytest.skip(f"banco de teste indisponível ({e.orig.__class__.__name__})")
    engine = create_engine(url, pool_pre_ping=True)
    migrar(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine_teste: Engine) -> Iterator[Session]:
    """Sessão cujo trabalho é desfeito no fim do teste (commits viram savepoints)."""
    with engine_teste.connect() as conn:
        transacao = conn.begin()
        sessao = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield sessao
        finally:
            sessao.close()
            transacao.rollback()


@pytest.fixture
def storage(tmp_path: Path) -> LocalStorage:
    """Storage numa pasta temporária: nada vai para o `storage/` de verdade."""
    return LocalStorage(tmp_path / "storage")


@pytest.fixture
def cliente(db: Session, storage: LocalStorage) -> Iterator[TestClient]:
    """API com o banco de teste e o storage temporário; o teste vê o que a rota gravou."""
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_storage] = lambda: storage
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
