"""Vistas extras (outro lado, sola, trás), registro por IoU e hipótese de seção transversal."""

import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.alinhamento import alinhar_vistas, iou
from relevo_pipeline.cor import COR_SOLADO, srgb_para_linear
from relevo_pipeline.sintetico import gerar_fotos, projecoes, tenis_implicito
from relevo_pipeline.voxel import campo_implicito, campo_secao, esculpir


@pytest.fixture(scope="module")
def fotos6():
    return gerar_fotos(extras=True)


def _recortado(occ):
    idx = [np.nonzero(occ.any(axis=tuple(a for a in range(3) if a != e)))[0] for e in range(3)]
    return occ[tuple(slice(i.min(), i.max() + 1) for i in idx)]


def test_vista_desconhecida_e_erro(fotos6):
    with pytest.raises(ValueError, match="Vista desconhecida: diagonal"):
        processar(fotos6["lateral"], fotos6["topo"], extras={"diagonal": fotos6["tras"]})


def test_seis_vistas_dao_o_mesmo_tamanho_que_tres(fotos6):
    args = dict(comprimento_cm=28, resolucao=64, colorir=False)
    tres = processar(fotos6["lateral"], fotos6["topo"], fotos6["frente"], **args)
    extras = {k: fotos6[k] for k in ("outro_lado", "sola", "tras")}
    seis = processar(fotos6["lateral"], fotos6["topo"], fotos6["frente"], extras=extras, **args)
    assert np.allclose(tres.malha.extents, seis.malha.extents, atol=0.4)
    assert seis.metricas["vistas"] == ["lateral", "topo", "frente", "outro_lado", "sola", "tras"]
    assert min(v for k, v in seis.consistencia.items() if k.startswith("iou_")) > 0.9
    assert seis.vistas.registradas == [], "fotos no espelhamento físico certo não são trocadas"
    assert seis.avisos == []


def test_sem_frente_a_traseira_faz_o_papel_dela(fotos6):
    r = processar(fotos6["lateral"], fotos6["topo"], extras={"tras": fotos6["tras"]},
                  comprimento_cm=28, resolucao=64, colorir=False)  # fmt: skip
    assert r.malha.is_watertight
    assert abs(r.consistencia["razao_tras"] - 1) < 0.05


def test_foto_da_sola_colore_o_solado(fotos6):
    """Sem foto da sola o solado é cinza neutro; com ela, sai da cor do objeto (vermelho)."""
    args = dict(comprimento_cm=28, resolucao=64)
    sem = processar(fotos6["lateral"], fotos6["topo"], **args)
    com = processar(fotos6["lateral"], fotos6["topo"], extras={"sola": fotos6["sola"]}, **args)

    def cor_de_baixo(r):
        baixo = r.malha.vertex_normals[:, 1] < -0.8
        return r.malha.visual.vertex_colors[baixo, :3].astype(float).mean(axis=0)

    neutro = srgb_para_linear(COR_SOLADO / 255) * 255
    vermelho = srgb_para_linear(np.array([170, 50, 60]) / 255) * 255
    assert np.abs(cor_de_baixo(sem) - neutro).max() < 10
    assert np.abs(cor_de_baixo(com) - vermelho).max() < 25


def _occ_assimetrico():
    """Tênis sintético com um "reforço" só no lado +z (o real é quase simétrico)."""
    occ = tenis_implicito(96).copy()
    L, H, W = occ.shape
    occ[: L // 2, : H // 3, W // 2 :] |= occ[: L // 2, : H // 3, :].any(axis=2, keepdims=True)
    return _recortado(occ)


def test_registro_detecta_foto_da_sola_do_outro_pe():
    occ = _occ_assimetrico()
    p = projecoes(occ, ("lateral", "topo", "sola"))
    do_mesmo_pe = alinhar_vistas(p["lateral"], p["topo"], extras={"sola": p["sola"]}, resolucao=96)
    outro_pe = alinhar_vistas(
        p["lateral"], p["topo"], extras={"sola": p["sola"][::-1]}, resolucao=96
    )
    assert do_mesmo_pe.registradas == []
    assert outro_pe.registradas == ["sola"]
    assert np.array_equal(outro_pe.mascaras["sola"], do_mesmo_pe.mascaras["sola"])


def test_frente_no_espelhamento_certo_reconstroi_o_lado_certo():
    """Regressão: a escultura usava a foto frontal espelhada em relação à cor (só aparecia em
    tênis assimétricos). Com a convenção física, o hull contém o objeto real."""
    occ = _occ_assimetrico()
    p = projecoes(occ, ("lateral", "topo", "frente"))
    v = alinhar_vistas(p["lateral"], p["topo"], p["frente"], resolucao=occ.shape[0])
    hull = esculpir(v)
    assert hull.shape == occ.shape
    assert (hull | ~occ).mean() > 0.995, "o hull sempre contém o objeto real"


def test_secao_transversal_aproxima_a_forma_real():
    """No sintético a forma real é conhecida: a seção comum chega mais perto que o hull puro."""
    occ = _recortado(tenis_implicito(128))
    p = projecoes(occ, ("lateral", "topo", "frente"))
    v = alinhar_vistas(p["lateral"], p["topo"], p["frente"], resolucao=occ.shape[0])
    hull = campo_implicito(v)
    secao, perfil = campo_secao(hull)
    final = np.maximum(hull, secao) < 0
    assert iou(hull < 0, occ) < 0.93
    assert iou(final, occ) > 0.96
    assert (occ & ~final).sum() < 0.02 * occ.sum(), "quase nada do objeto real é cortado"
    assert perfil.mean() < 0.95


def test_secao_sem_frente_nao_muda_quase_nada():
    occ = _recortado(tenis_implicito(96))
    p = projecoes(occ, ("lateral", "topo"))
    hull = campo_implicito(alinhar_vistas(p["lateral"], p["topo"], resolucao=occ.shape[0]))
    final = np.maximum(hull, campo_secao(hull)[0]) < 0
    assert final.sum() > 0.97 * (hull < 0).sum()
