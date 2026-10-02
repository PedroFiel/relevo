"""Estúdio: regerar um tênis de samples/reais com novos ajustes (usa uma raiz temporária)."""

import json
import shutil

import pytest
from fastapi.testclient import TestClient
from relevo_api.main import app
from relevo_api.servicos import amostras
from relevo_pipeline.sintetico import salvar_fotos


@pytest.fixture
def raiz(tmp_path, monkeypatch):
    pasta = tmp_path / "samples" / "reais" / "tenis-99"
    salvar_fotos(pasta)
    for f in pasta.glob("*.png"):
        shutil.move(f, pasta / f.name)
    original = amostras.regerar

    def regerar_na_raiz(*args, **kwargs):
        return original(*args, raiz=tmp_path, **kwargs)

    monkeypatch.setattr("relevo_api.routers.amostras.regerar", regerar_na_raiz)
    return tmp_path


def test_regera_grava_ajustes_e_publica(raiz):
    ajustes = {"topo": {"rotacao_graus": 0, "recorte": [10, 10, 500, 200]}}
    r = TestClient(app).post("/amostras/tenis-99/gerar", json={"ajustes": ajustes, "resolucao": 64})
    assert r.status_code == 200, r.text
    assert r.json()["fechada"] is True
    assert isinstance(r.json()["versao"], int)
    salvo = json.loads((raiz / "samples/reais/tenis-99/ajustes.json").read_text())
    assert salvo["topo"]["recorte"] == [10, 10, 500, 200]
    publico = raiz / "apps/web/public/samples"
    assert (publico / "tenis-99.glb").exists()
    assert (publico / "tenis-99/metricas.json").exists()


def test_recorte_invalido_volta_422_com_mensagem(raiz):
    ajustes = {"topo": {"recorte": [0, 0, 10, 10]}}
    r = TestClient(app).post("/amostras/tenis-99/gerar", json={"ajustes": ajustes, "resolucao": 64})
    assert r.status_code == 422
    assert "Desenhe um retângulo maior" in r.json()["detail"]
    assert not (raiz / "samples/reais/tenis-99/ajustes.json").exists(), "inválido não é gravado"


@pytest.mark.parametrize("nome", ["../etc", "tenis-1", "outro"])
def test_nome_fora_do_padrao_e_404(nome):
    assert TestClient(app).post(f"/amostras/{nome}/gerar", json={}).status_code == 404
