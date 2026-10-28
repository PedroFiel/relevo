"""Tabelas do MVP [F3-T01]: restrições, cascatas, usuário demo e a migração."""

from decimal import Decimal

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from conftest import migrar
from relevo_api.db import Base
from relevo_api.models import (
    USUARIO_DEMO_ID,
    Arquivo,
    Imagem,
    Job,
    Modelo,
    Usuario,
    Versao,
)
from relevo_pipeline.vistas import VISTAS
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError


def novo_modelo(db, **campos) -> Modelo:
    padrao = {
        "usuario_id": USUARIO_DEMO_ID,
        "nome": "Tênis azul",
        "comprimento_cm": Decimal("28.5"),
    }
    modelo = Modelo(**(padrao | campos))
    db.add(modelo)
    db.flush()
    return modelo


def imagem(vista: str) -> Imagem:
    return Imagem(
        vista=vista, caminho=f"fotos/{vista}.jpg", largura_px=1200, altura_px=800, tamanho_bytes=1
    )


def contar(db, tabela: str) -> int:
    return db.execute(text(f"SELECT count(*) FROM {tabela}")).scalar_one()


def test_usuario_demo_vem_da_migracao(db):
    demo = db.get(Usuario, USUARIO_DEMO_ID)
    assert demo is not None
    assert demo.email == "demo@relevo.local"
    assert demo.creditos == 0


def test_modelo_aceita_as_6_vistas_do_pipeline(db):
    modelo = novo_modelo(db)
    modelo.imagens = [imagem(v) for v in VISTAS]
    db.flush()
    db.refresh(modelo)
    assert {i.vista for i in modelo.imagens} == set(VISTAS)
    assert modelo.status == "rascunho"  # default do banco
    assert modelo.versao_atual is None
    assert modelo.criado_em.tzinfo is not None  # timestamptz


def test_mesma_vista_duas_vezes_e_recusada(db):
    modelo = novo_modelo(db)
    modelo.imagens = [imagem("lateral"), imagem("lateral")]
    with pytest.raises(IntegrityError, match="uq_imagens_modelo_id_vista"):
        db.flush()


@pytest.mark.parametrize(
    ("campos", "restricao"),
    [
        ({"status": "pausado"}, "ck_modelos_status"),
        ({"comprimento_cm": Decimal("2")}, "ck_modelos_comprimento_cm"),
        ({"comprimento_cm": Decimal("61")}, "ck_modelos_comprimento_cm"),
    ],
)
def test_checks_do_modelo(db, campos, restricao):
    with pytest.raises(IntegrityError, match=restricao):
        novo_modelo(db, **campos)


def test_vista_desconhecida_e_recusada(db):
    modelo = novo_modelo(db)
    modelo.imagens = [imagem("diagonal")]
    with pytest.raises(IntegrityError, match="ck_imagens_vista"):
        db.flush()


@pytest.mark.parametrize(
    ("campos", "restricao"),
    [({"status": "rodando"}, "ck_jobs_status"), ({"progresso": 101}, "ck_jobs_progresso")],
)
def test_checks_do_job(db, campos, restricao):
    modelo = novo_modelo(db)
    db.add(Job(modelo_id=modelo.id, **campos))
    with pytest.raises(IntegrityError, match=restricao):
        db.flush()


def test_job_comeca_pendente_com_parametros_jsonb(db):
    modelo = novo_modelo(db)
    job = Job(modelo_id=modelo.id, parametros={"resolucao": 128, "ajustes": {"topo": {}}})
    db.add(job)
    db.flush()
    db.refresh(job)
    assert (job.status, job.progresso) == ("pendente", 0)
    consulta = text("SELECT parametros->>'resolucao' FROM jobs WHERE id = :id")
    assert db.execute(consulta, {"id": job.id}).scalar_one() == "128"


def test_numero_da_versao_e_unico_por_modelo(db):
    modelo = novo_modelo(db)
    db.add_all([Versao(modelo_id=modelo.id, numero=1), Versao(modelo_id=modelo.id, numero=1)])
    with pytest.raises(IntegrityError, match="uq_versoes_modelo_id_numero"):
        db.flush()


def test_apagar_modelo_apaga_tudo_em_cascata(db):
    modelo = novo_modelo(db)
    modelo.imagens = [imagem("lateral"), imagem("topo")]
    job = Job(modelo=modelo)
    versao = Versao(modelo=modelo, job=job, numero=1, metricas={"faces": 20000})
    glb = Arquivo(tipo="glb", nome="modelo.glb", caminho="v1/modelo.glb", tamanho_bytes=9)
    versao.arquivos = [glb]
    db.add_all([job, versao])
    db.flush()
    # DELETE direto no banco: quem apaga as filhas é o ON DELETE CASCADE, não o ORM
    db.execute(text("DELETE FROM modelos WHERE id = :id"), {"id": modelo.id})
    for tabela in ("imagens", "jobs", "versoes", "arquivos"):
        assert contar(db, tabela) == 0, tabela


def test_apagar_job_mantem_a_versao(db):
    modelo = novo_modelo(db)
    job = Job(modelo=modelo)
    versao = Versao(modelo=modelo, job=job, numero=1)
    db.add_all([job, versao])
    db.flush()
    db.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job.id})
    assert db.execute(select(Versao.job_id).where(Versao.id == versao.id)).scalar_one() is None


def test_modelos_do_usuario_demo_em_ordem(db):
    for nome in ("a", "b"):
        db.add(Modelo(usuario_id=USUARIO_DEMO_ID, nome=nome, comprimento_cm=28))
    db.flush()
    total = db.scalar(select(func.count()).where(Modelo.usuario_id == USUARIO_DEMO_ID))
    assert total == 2


def test_migracao_igual_aos_modelos(engine_teste):
    """Nada no models.py ficou sem migração (o que o autogenerate geraria agora é vazio)."""
    with engine_teste.connect() as conn:
        diferencas = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diferencas == []


def test_migracao_ida_e_volta(engine_teste):
    migrar(engine_teste, "base", descer=True)
    with engine_teste.connect() as conn:
        tabelas = conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        ).scalars()
        assert set(tabelas) <= {"alembic_version"}
    migrar(engine_teste)
    with engine_teste.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM usuarios")).scalar_one() == 1
