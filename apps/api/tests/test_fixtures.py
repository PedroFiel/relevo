"""Fixture `cliente` [F3-T04]: a rota usa o banco e o storage de teste, não os de verdade."""

from collections.abc import Iterator
from decimal import Decimal
from typing import Annotated

import pytest
from fastapi import APIRouter, Depends
from relevo_api.config import settings
from relevo_api.db import get_db
from relevo_api.main import app
from relevo_api.models import USUARIO_DEMO_ID, Modelo
from relevo_api.storage import Storage, get_storage
from sqlalchemy import select
from sqlalchemy.orm import Session

NOME = "Tênis da rota de teste"


@pytest.fixture
def rota_de_teste() -> Iterator[None]:
    """Rota provisória que grava no banco e no storage pelas dependências reais da API."""
    router = APIRouter()

    @router.post("/_teste/gravar")
    def gravar(
        db: Annotated[Session, Depends(get_db)],
        storage: Annotated[Storage, Depends(get_storage)],
    ) -> dict:
        modelo = Modelo(usuario_id=USUARIO_DEMO_ID, nome=NOME, comprimento_cm=Decimal("28"))
        db.add(modelo)
        db.commit()  # numa rota de verdade é assim; no teste vira savepoint
        chave = storage.salvar(f"modelos/{modelo.id}/fotos/lateral.jpg", b"\xff\xd8")
        return {"id": str(modelo.id), "chave": chave}

    antes = list(app.router.routes)
    app.include_router(router)
    yield
    app.router.routes[:] = antes


def test_rota_grava_no_banco_e_no_storage_de_teste(rota_de_teste, cliente, db, storage):
    r = cliente.post("/_teste/gravar")
    assert r.status_code == 200
    corpo = r.json()

    # A sessão do teste enxerga o commit da rota: é a mesma transação
    assert db.scalar(select(Modelo.nome).where(Modelo.id == corpo["id"])) == NOME
    assert storage.abrir(corpo["chave"]) == b"\xff\xd8"
    assert not (settings.storage_dir / corpo["chave"]).exists()


def test_nada_sobra_entre_testes(db):
    # Roda depois do teste acima (ordem do arquivo): o commit da rota foi desfeito
    assert db.scalar(select(Modelo).where(Modelo.nome == NOME)) is None


def test_trocas_sao_desfeitas_depois_do_cliente():
    assert app.dependency_overrides == {}
