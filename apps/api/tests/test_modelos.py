"""Rotas de modelos, jobs e arquivos [F3-T03, F3-T05, F3-T06] com o banco e o storage de teste.

O `TestClient` só devolve a resposta do POST depois de rodar a tarefa em segundo plano, então logo
após o 202 o job já terminou (com sucesso ou erro) — dá para conferir tudo em sequência.
"""

import io
import json
import uuid
from decimal import Decimal

import cv2
import numpy as np
import pytest
import trimesh
from relevo_api.db import get_fabrica_sessao
from relevo_api.main import app
from relevo_api.models import USUARIO_DEMO_ID, Arquivo, Imagem, Job, Modelo, Usuario, Versao
from relevo_api.servicos import processamento
from relevo_api.servicos.modelos import ETAPAS_JOB
from relevo_api.servicos.processamento import ERRO_INTERROMPIDO, marcar_interrompidos
from relevo_api.storage import prefixo_modelo
from relevo_pipeline.sintetico import gerar_fotos
from sqlalchemy import select, text


@pytest.fixture(scope="module")
def fotos_png() -> dict[str, bytes]:
    return {v: cv2.imencode(".png", img)[1].tobytes() for v, img in gerar_fotos().items()}


def enviar(cliente, fotos: dict[str, bytes], **campos):
    dados = {"nome": "Tênis sintético", "comprimento_cm": "28", "resolucao": "64", **campos}
    arquivos = {v: (f"{v}.png", io.BytesIO(b), "image/png") for v, b in fotos.items()}
    return cliente.post("/modelos", data=dados, files=arquivos)


@pytest.fixture
def criado(cliente, fotos_png) -> dict:
    r = enviar(cliente, fotos_png)
    assert r.status_code == 202, r.text
    return r.json()


# ---------- POST /modelos (F3-T03) ----------
def test_cria_modelo_imagens_e_job(criado, db, storage):
    modelo = db.get(Modelo, uuid.UUID(criado["modelo_id"]))
    assert modelo.nome == "Tênis sintético" and modelo.comprimento_cm == Decimal("28.00")
    assert sorted(i.vista for i in modelo.imagens) == ["frente", "lateral", "topo"]
    for imagem in modelo.imagens:
        assert storage.abrir(imagem.caminho)[:4] == b"\x89PNG"
        assert imagem.largura_px > 0 and imagem.tamanho_bytes > 0
    job = db.get(Job, uuid.UUID(criado["job_id"]))
    assert job.parametros["resolucao"] == 64 and job.parametros["faces_alvo"] == 20_000


def test_sem_topo_da_422(cliente, fotos_png):
    r = enviar(cliente, {"lateral": fotos_png["lateral"]})
    assert r.status_code == 422


def test_txt_renomeado_para_jpg_da_400(cliente, fotos_png, db):
    antes = db.scalar(select(Modelo.id).limit(1))
    r = cliente.post(
        "/modelos",
        data={"nome": "x", "comprimento_cm": "28"},
        files={
            "lateral": ("lateral.jpg", b"isto nao e uma foto", "image/jpeg"),
            "topo": ("topo.png", fotos_png["topo"], "image/png"),
        },
    )
    assert r.status_code == 400
    assert "lateral" in r.json()["detail"] and "JPEG" in r.json()["detail"]
    assert db.scalar(select(Modelo.id).limit(1)) == antes  # nada gravado


def test_jpeg_corrompido_da_400(cliente, fotos_png):
    r = enviar(cliente, {**fotos_png, "lateral": b"\xff\xd8\xff" + b"lixo" * 100})
    assert r.status_code == 400
    assert "corrompido" in r.json()["detail"]


def test_foto_de_11_mb_da_413(cliente, fotos_png):
    grande = b"\xff\xd8\xff" + bytes(11 * 1024 * 1024)
    r = enviar(cliente, {**fotos_png, "topo": grande})
    assert r.status_code == 413
    assert "10 MB" in r.json()["detail"]


@pytest.mark.parametrize(
    ("ajustes", "trecho"),
    [
        ("{nao e json", "JSON"),
        (json.dumps({"topo": {"rotacao_graus": 45}}), "Rotação"),
        (json.dumps({"sola": {"rotacao_graus": 90}}), "sem foto"),
        (json.dumps({"lateral": {"recorte": [0, 0, 10, 10]}}), "pequeno"),
        (json.dumps({"bico": {}}), "bico"),
    ],
)
def test_ajustes_invalidos_dao_422(cliente, fotos_png, ajustes, trecho):
    r = enviar(cliente, fotos_png, ajustes=ajustes)
    assert r.status_code == 422
    assert trecho in r.json()["detail"]


def test_comprimento_fora_da_faixa_da_422(cliente, fotos_png):
    assert enviar(cliente, fotos_png, comprimento_cm="2").status_code == 422


# ---------- Execução do job (F3-T05) ----------
def test_job_gera_versao_com_glb_e_metricas(criado, db, storage):
    modelo = db.get(Modelo, uuid.UUID(criado["modelo_id"]))
    job = db.get(Job, uuid.UUID(criado["job_id"]))
    db.refresh(modelo)
    db.refresh(job)
    assert job.status == "concluido" and job.progresso == 100 and job.erro is None
    assert job.iniciado_em and job.finalizado_em and "tempos_s" in job.metricas
    assert modelo.status == "pronto" and modelo.versao_atual == 1
    versao = modelo.versoes[0]
    assert versao.numero == 1 and versao.job_id == job.id
    assert versao.metricas["fechada"] is True and versao.metricas["faces"] > 0
    (arquivo,) = versao.arquivos
    malha = trimesh.load(io.BytesIO(storage.abrir(arquivo.caminho)), file_type="glb", force="mesh")
    assert malha.extents[0] == pytest.approx(28, abs=0.5)
    assert arquivo.tamanho_bytes == len(storage.abrir(arquivo.caminho))


def test_job_grava_as_etapas_em_ordem(cliente, fotos_png, db, monkeypatch):
    vistas: list[tuple[str, int]] = []
    original = processamento.processar

    def espiao(*args, ao_progredir, **kwargs):
        def gravar_e_conferir(etapa, pct):
            ao_progredir(etapa, pct)
            job = db.scalar(select(Job).where(Job.status == "processando"))
            db.refresh(job)
            vistas.append((job.etapa_atual, job.progresso))

        return original(*args, ao_progredir=gravar_e_conferir, **kwargs)

    monkeypatch.setattr(processamento, "processar", espiao)
    assert enviar(cliente, fotos_png).status_code == 202
    assert [e for e, _ in vistas] == ETAPAS_JOB
    progressos = [p for _, p in vistas]
    assert progressos == sorted(progressos) and progressos[-1] == 90


def test_foto_toda_branca_vira_erro_com_mensagem(cliente, db):
    branca = cv2.imencode(".png", np.full((300, 500, 3), 255, np.uint8))[1].tobytes()
    r = enviar(cliente, {"lateral": branca, "topo": branca})
    assert r.status_code == 202
    job = db.get(Job, uuid.UUID(r.json()["job_id"]))
    db.refresh(job)
    assert job.status == "erro" and job.erro and job.finalizado_em
    assert "Traceback" not in job.erro
    assert job.modelo.status == "erro"
    corpo = cliente.get(f"/jobs/{job.id}").json()
    assert corpo["status"] == "erro" and corpo["erro"] == job.erro


def test_erro_inesperado_vira_mensagem_generica(cliente, fotos_png, db, monkeypatch):
    def quebra(*a, **k):
        raise RuntimeError("detalhe interno")

    monkeypatch.setattr(processamento, "processar", quebra)
    r = enviar(cliente, fotos_png)
    job = db.get(Job, uuid.UUID(r.json()["job_id"]))
    db.refresh(job)
    assert job.status == "erro" and job.erro == processamento.ERRO_GENERICO


APAGA_EM_PROCESSAMENTO = text(
    "DELETE FROM modelos WHERE id IN (SELECT modelo_id FROM jobs WHERE status = 'processando')"
)


@pytest.mark.parametrize("quando", ["no_meio", "depois_do_glb"])
def test_apagar_modelo_durante_o_job_limpa_os_arquivos(
    cliente, fotos_png, db, storage, monkeypatch, quando
):
    """O DELETE chega no meio do job ou logo depois de o `.glb` ser salvo: sem erro, sem sobras."""
    # SQL cru na sessão do job, gravado na hora: o ORM não fica sabendo, como num DELETE de outra
    # requisição (nesses dois pontos o job não tem nada pendente para o commit levar junto)
    fabrica_teste = app.dependency_overrides[get_fabrica_sessao]()
    sessoes = []

    def apagar_por_fora():
        sessoes[0].execute(APAGA_EM_PROCESSAMENTO)
        sessoes[0].commit()

    def fabrica():
        sessoes.append(fabrica_teste())
        return sessoes[-1]

    monkeypatch.setitem(app.dependency_overrides, get_fabrica_sessao, lambda: fabrica)
    original_processar, original_salvar = processamento.processar, storage.salvar

    def processar(*args, ao_progredir, **kwargs):
        def progredir(etapa, pct):
            if quando == "no_meio" and etapa == "alinhamento":
                apagar_por_fora()
            ao_progredir(etapa, pct)

        return original_processar(*args, ao_progredir=progredir, **kwargs)

    def salvar(chave, dados):
        resultado = original_salvar(chave, dados)
        if chave.endswith(".glb"):
            apagar_por_fora()
        return resultado

    monkeypatch.setattr(processamento, "processar", processar)
    monkeypatch.setattr(storage, "salvar", salvar)
    r = enviar(cliente, fotos_png)
    assert r.status_code == 202
    modelo_id = uuid.UUID(r.json()["modelo_id"])
    assert db.get(Modelo, modelo_id) is None
    assert not storage.caminho_local(prefixo_modelo(modelo_id)).exists()


def test_startup_marca_jobs_abertos_como_erro(db):
    modelo = Modelo(
        usuario_id=USUARIO_DEMO_ID, nome="x", comprimento_cm=Decimal(28), status="processando"
    )
    modelo.jobs = [Job(status="processando"), Job(status="concluido")]
    db.add(modelo)
    db.commit()
    assert marcar_interrompidos(db) == 1
    db.refresh(modelo)
    status = sorted(j.status for j in modelo.jobs)
    assert status == ["concluido", "erro"] and modelo.status == "erro"
    assert ERRO_INTERROMPIDO in [j.erro for j in modelo.jobs]


# ---------- Leitura, download e delete (F3-T06) ----------
def test_get_job(cliente, criado):
    corpo = cliente.get(f"/jobs/{criado['job_id']}").json()
    assert corpo["status"] == "concluido" and corpo["progresso"] == 100
    assert corpo["etapas"] == ETAPAS_JOB and corpo["modelo_id"] == criado["modelo_id"]


def test_lista_modelos(cliente, criado):
    lista = cliente.get("/modelos").json()
    item = next(m for m in lista if m["id"] == criado["modelo_id"])
    assert item["status"] == "pronto" and item["versao_atual"] == 1
    assert item["miniatura_url"].startswith("/imagens/")


def test_detalhe_e_downloads(cliente, criado):
    corpo = cliente.get(f"/modelos/{criado['modelo_id']}").json()
    assert corpo["status"] == "pronto" and corpo["comprimento_cm"] == 28
    assert [i["vista"] for i in corpo["imagens"]] == ["lateral", "topo", "frente"]
    assert corpo["job"]["id"] == criado["job_id"]
    versao = corpo["versao"]
    assert versao["numero"] == 1 and versao["metricas"]["fechada"] is True
    (arquivo,) = versao["arquivos"]

    r = cliente.get(arquivo["url"])
    assert r.status_code == 200 and r.headers["content-type"] == "model/gltf-binary"
    malha = trimesh.load(io.BytesIO(r.content), file_type="glb", force="mesh")
    assert len(malha.faces) == versao["metricas"]["faces"]

    foto = cliente.get(corpo["imagens"][0]["url"])
    assert foto.status_code == 200 and foto.headers["content-type"] == "image/png"


def test_apagar_modelo_apaga_linhas_e_arquivos(cliente, criado, db, storage):
    modelo_id = uuid.UUID(criado["modelo_id"])
    assert storage.caminho_local(prefixo_modelo(modelo_id)).exists()
    assert cliente.delete(f"/modelos/{modelo_id}").status_code == 204
    assert not storage.caminho_local(prefixo_modelo(modelo_id)).exists()
    assert cliente.get(f"/modelos/{modelo_id}").status_code == 404
    assert db.scalar(select(Imagem).where(Imagem.modelo_id == modelo_id)) is None
    assert db.scalar(select(Versao).where(Versao.modelo_id == modelo_id)) is None


@pytest.mark.parametrize(
    "rota",
    ["/modelos/{}", "/jobs/{}", "/arquivos/{}/download", "/imagens/{}"],
)
def test_id_inexistente_da_404(cliente, rota):
    r = cliente.get(rota.format(uuid.uuid4()))
    assert r.status_code == 404 and r.json()["detail"]


def test_delete_inexistente_da_404(cliente):
    assert cliente.delete(f"/modelos/{uuid.uuid4()}").status_code == 404


def test_modelo_de_outro_usuario_da_404(cliente, db):
    outro = Usuario(nome="Outra pessoa", email=f"{uuid.uuid4()}@exemplo.com")
    db.add(outro)
    db.flush()
    modelo = Modelo(usuario_id=outro.id, nome="Dela", comprimento_cm=Decimal(28))
    versao = Versao(
        numero=1, arquivos=[Arquivo(tipo="glb", nome="m.glb", caminho="x/m.glb", tamanho_bytes=1)]
    )
    modelo.versoes = [versao]
    modelo.jobs = [Job()]
    db.add(modelo)
    db.commit()
    assert cliente.get(f"/modelos/{modelo.id}").status_code == 404
    assert cliente.get(f"/jobs/{modelo.jobs[0].id}").status_code == 404
    assert cliente.get(f"/arquivos/{versao.arquivos[0].id}/download").status_code == 404
    assert cliente.delete(f"/modelos/{modelo.id}").status_code == 404
    assert all(m["id"] != str(modelo.id) for m in cliente.get("/modelos").json())
