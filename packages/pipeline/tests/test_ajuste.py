"""Ajuste da foto pelo usuário: rotação + recorte e a matriz 3×3 de volta à original (F1-T11)."""

import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.ajuste import (
    AjusteFoto,
    aplicar_ajuste,
    aplicar_matriz,
    ler_ajustes,
    limitar_recorte,
)
from relevo_pipeline.orientacao import Orientacao
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos


def _confere_matriz(original, ajustada, M):
    """Cada pixel da ajustada, levado por M, cai no pixel de mesmo valor na original."""
    ys, xs = np.mgrid[: ajustada.shape[0], : ajustada.shape[1]]
    centros = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], axis=1)
    o = np.floor(aplicar_matriz(M, centros)).astype(int)
    return (original[o[:, 1], o[:, 0]] == ajustada.ravel()).all()


@pytest.fixture
def imagem():
    return np.random.default_rng(0).integers(0, 255, (300, 400), dtype=np.uint8)


@pytest.mark.parametrize("graus", [0, 90, 180, 270])
@pytest.mark.parametrize("recorte", [None, (20, 30, 150, 120)])
def test_matriz_leva_de_volta_a_original(imagem, graus, recorte):
    ajustada, M = aplicar_ajuste(imagem, AjusteFoto(graus, recorte))
    if recorte:
        assert ajustada.shape == (120, 150)
    assert _confere_matriz(imagem, ajustada, M)


def test_rotacao_e_no_sentido_horario(imagem):
    ajustada, _ = aplicar_ajuste(imagem, AjusteFoto(90))
    assert ajustada.shape == (400, 300)
    assert ajustada[0, -1] == imagem[0, 0], "o canto superior esquerdo vai para o superior direito"


def test_recorte_fora_da_imagem_e_limitado_e_retangulo_invertido_e_normalizado():
    assert limitar_recorte((-50, -10, 200, 100), 400, 300) == (0, 0, 150, 90)
    assert limitar_recorte((300, 200, -100, -80), 400, 300) == (200, 120, 100, 80)


def test_recorte_pequeno_demais_explica_o_que_fazer(imagem):
    with pytest.raises(ValueError, match="Desenhe um retângulo maior"):
        aplicar_ajuste(imagem, AjusteFoto(0, (390, 0, 100, 100)))


def test_rotacao_invalida(imagem):
    with pytest.raises(ValueError, match="0, 90, 180 ou 270"):
        aplicar_ajuste(imagem, AjusteFoto(45))


def test_ler_ajustes_e_ida_e_volta():
    a = ler_ajustes({"topo": {"rotacao_graus": 270, "recorte": [1, 2, 300, 400]}})
    assert a["topo"] == AjusteFoto(270, (1, 2, 300, 400))
    assert a["topo"].para_dict() == {"rotacao_graus": 270, "recorte": [1, 2, 300, 400]}


def test_mascara_com_recorte_igual_a_da_foto_ja_recortada():
    foto = gerar_fotos()["lateral"]
    recorte = (40, 30, foto.shape[1] - 80, foto.shape[0] - 60)
    ajustada, _ = aplicar_ajuste(foto, AjusteFoto(0, recorte))
    x, y, w, h = recorte
    assert np.array_equal(gerar_mascara(ajustada), gerar_mascara(foto[y : y + h, x : x + w]))


def test_matriz_da_orientacao_automatica():
    img = np.random.default_rng(1).integers(0, 255, (21, 34))
    for k in range(4):
        for espelhada in (False, True):
            o = Orientacao(k, espelhada)
            assert _confere_matriz(img, o.aplicar(img), o.matriz(34, 21))


def test_recorte_tira_o_segundo_objeto_do_quadro():
    """O caso do tenis-03: a foto traz o par; recortando um tênis o aviso some."""
    fotos = gerar_fotos()
    lateral = fotos["lateral"]
    h, w = lateral.shape[:2]
    par = np.concatenate([lateral, lateral], axis=1)  # dois tênis lado a lado
    args = dict(comprimento_cm=28, resolucao=48, colorir=False)
    sem = processar(par, fotos["topo"], **args)
    com = processar(par, fotos["topo"], ajustes={"lateral": AjusteFoto(0, (0, 0, w, h))}, **args)
    assert any("mais de um objeto" in a for a in sem.avisos)
    assert not any("mais de um objeto" in a for a in com.avisos)
    assert com.metricas["ajustes"]["lateral"]["recorte"] == [0, 0, w, h]


def test_rotacao_manual_desliga_a_automatica():
    fotos = gerar_fotos()
    topo_em_pe = np.rot90(fotos["topo"], 1).copy()  # anti-horário: calcanhar embaixo
    r = processar(
        fotos["lateral"],
        topo_em_pe,
        comprimento_cm=28,
        resolucao=48,
        colorir=False,
        ajustes={"topo": AjusteFoto(90)},  # o usuário desfaz girando 90° no horário
    )
    assert "topo" not in r.metricas["orientacao"]
    assert not any("Giramos a foto de topo" in a for a in r.avisos)
    assert r.malha.extents[2] < 0.5 * r.malha.extents[0], "largura de tênis, não de 'tênis em pé'"


def test_ajuste_de_vista_sem_foto_e_erro():
    fotos = gerar_fotos()
    with pytest.raises(ValueError, match="sem foto: sola"):
        processar(fotos["lateral"], fotos["topo"], ajustes={"sola": AjusteFoto(90)})
