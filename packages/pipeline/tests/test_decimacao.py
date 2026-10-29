"""Decimação por erro quádrico [F1-T03]: menos faces, mesma forma, malha sempre fechada."""

import numpy as np
import pytest
import trimesh
from relevo_pipeline import processar
from relevo_pipeline.malha import decimar, erro_geometrico_cm
from relevo_pipeline.sintetico import gerar_fotos


@pytest.fixture(scope="module")
def fotos():
    return gerar_fotos()


@pytest.fixture(scope="module")
def malha(fotos):
    return processar(fotos["lateral"], fotos["topo"], fotos["frente"], colorir=False).malha


def test_decima_ate_o_alvo_mantendo_a_forma(malha):
    alvo = len(malha.faces) // 2
    reduzida, info = decimar(malha, alvo)
    assert len(reduzida.faces) <= alvo * 1.02
    assert reduzida.is_watertight
    assert info["usada"] and info["faces_antes"] == len(malha.faces)
    assert info["erro_medio_mm"] < 0.5
    np.testing.assert_allclose(reduzida.extents, malha.extents, rtol=0.01)
    # A cor por vértice depende disto para achar o voxel de cada vértice
    assert reduzida.metadata["tamanho_voxel"] == malha.metadata["tamanho_voxel"]


def test_sem_alvo_ou_malha_pequena_devolve_a_mesma(malha):
    assert decimar(malha, None)[0] is malha
    mesma, info = decimar(malha, len(malha.faces) + 10)
    assert mesma is malha and not info["usada"]


def test_se_abrir_a_malha_fica_com_a_original(malha, monkeypatch):
    def abre(self, face_count):
        aberta = self.copy()
        aberta.update_faces(np.arange(1, len(aberta.faces)))  # tira um triângulo: buraco
        return aberta

    monkeypatch.setattr(trimesh.Trimesh, "simplify_quadric_decimation", abre)
    resultado, info = decimar(malha, 1000)
    assert resultado is malha and resultado.is_watertight
    assert not info["usada"] and info["motivo"]


def test_erro_geometrico_de_malha_igual_e_zero():
    esfera = trimesh.creation.icosphere(subdivisions=3)
    medio, maximo = erro_geometrico_cm(esfera, esfera)
    assert medio < 1e-9 and maximo < 1e-9


def test_pipeline_decima_e_colore_a_malha_reduzida(fotos):
    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], faces_alvo=5000)
    assert len(r.malha.faces) <= 5000 * 1.02
    assert r.malha.is_watertight
    assert r.malha.visual.kind == "vertex"
    assert len(r.malha.visual.vertex_colors) == len(r.malha.vertices)
    m = r.metricas
    assert m["decimacao"]["usada"] and m["faces"] == len(r.malha.faces)
    assert "decimacao" in m["tempos_s"]
