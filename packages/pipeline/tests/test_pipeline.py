import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.alinhamento import alinhar_vistas, recortar
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos, tenis_implicito
from relevo_pipeline.voxel import esculpir


@pytest.fixture(scope="module")
def fotos():
    return gerar_fotos()


# ---------- Segmentação ----------
def test_segmentacao_encontra_objeto_no_fundo_claro(fotos):
    m = gerar_mascara(fotos["lateral"])
    assert m.dtype == bool
    assert not m[0, 0], "canto da imagem deve ser fundo"
    assert 0.2 < m.mean() < 0.8


def test_segmentacao_funciona_com_fundo_escuro():
    img = np.full((200, 300, 3), 20, np.uint8)
    img[50:150, 80:220] = 220
    m = gerar_mascara(img)
    assert m[100, 150] and not m[10, 10]
    assert abs(m.sum() - 100 * 140) / (100 * 140) < 0.05


def test_segmentacao_preenche_buracos():
    img = np.full((200, 200, 3), 240, np.uint8)
    img[40:160, 40:160] = 30
    img[90:110, 90:110] = 240  # "buraco" claro dentro do objeto (ex.: logo branco)
    assert gerar_mascara(img)[100, 100]


# ---------- Alinhamento ----------
def test_recortar_vazio_gera_erro():
    with pytest.raises(ValueError):
        recortar(np.zeros((10, 10), bool))


def test_alinhamento_dimensoes_compativeis():
    lat = np.ones((50, 200), bool)  # proporção altura/comprimento = 0.25
    top = np.ones((40, 100), bool)  # proporção largura/comprimento = 0.4
    fre = np.ones((30, 30), bool)
    v = alinhar_vistas(lat, top, fre, resolucao=100)
    L, H, W = v.dims
    assert (L, H, W) == (100, 25, 40)
    assert v.lateral.shape == (H, L) and v.topo.shape == (W, L) and v.frente.shape == (H, W)


# ---------- Visual hull ----------
def test_visual_hull_de_caixa_e_caixa_cheia():
    v = alinhar_vistas(np.ones((10, 20), bool), np.ones((8, 20), bool), np.ones((10, 8), bool), 20)
    assert esculpir(v).all()


def test_visual_hull_contem_o_objeto_original():
    """Propriedade teórica: o visual hull SEMPRE contém o objeto real (nunca corta demais)."""
    occ = tenis_implicito(64)
    idx = [np.nonzero(occ.any(axis=tuple(a for a in range(3) if a != e)))[0] for e in range(3)]
    occ = occ[
        idx[0].min() : idx[0].max() + 1,
        idx[1].min() : idx[1].max() + 1,
        idx[2].min() : idx[2].max() + 1,
    ]  # recorta na bounding box 3D
    lateral = occ.any(axis=2).T[::-1, :]
    topo = occ.any(axis=1).T
    frente = occ.any(axis=0)[::-1, :]
    v = alinhar_vistas(lateral, topo, frente, resolucao=occ.shape[0])
    hull = esculpir(v)
    assert hull.shape == occ.shape
    assert (hull | ~occ).mean() > 0.99  # occ ⊆ hull (tolerância de reamostragem)
    assert hull.sum() >= occ.sum()


# ---------- Ponta a ponta ----------
def test_pipeline_ponta_a_ponta(fotos):
    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=28, resolucao=96)
    m = r.metricas
    assert m["fechada"], "a malha deve ser fechada (watertight) para impressão 3D"
    assert m["faces"] > 1000
    comprimento, altura, largura = r.malha.extents
    assert abs(comprimento - 28) < 1.0, "o modelo deve sair em escala real"
    assert 0 < altura < comprimento and 0 < largura < comprimento
