"""Orientação automática das fotos (calcanhar à esquerda, bico à direita)."""

import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.orientacao import (
    Orientacao,
    orientar_lateral,
    orientar_topo,
    posicao_antepe,
    razao_calcanhar,
)
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos


@pytest.fixture(scope="module")
def fotos():
    return gerar_fotos()


@pytest.fixture(scope="module")
def mascaras(fotos):
    return {k: gerar_mascara(v) for k, v in fotos.items()}


def test_sintetico_na_convencao_nao_e_alterado(mascaras):
    assert not orientar_topo(mascaras["topo"]).alterada
    assert not orientar_lateral(mascaras["lateral"]).alterada
    assert orientar_topo(mascaras["topo"]).confiante
    assert orientar_lateral(mascaras["lateral"]).confiante


def test_antepe_fica_do_lado_do_bico(mascaras):
    assert posicao_antepe(mascaras["topo"]) > 0.55
    assert razao_calcanhar(mascaras["lateral"]) > 1.15


@pytest.mark.parametrize("k", [1, 2, 3])
def test_topo_girado_volta_para_a_convencao(mascaras, k):
    """Foto de topo em pé (calcanhar em cima ou embaixo) ou de ponta-cabeça."""
    girada = np.rot90(mascaras["topo"], k)
    o = orientar_topo(girada)
    assert o.alterada and not o.espelhada, "topo só pode ser girado, nunca espelhado"
    assert np.array_equal(o.aplicar(girada), mascaras["topo"])


def test_lateral_com_bico_a_esquerda_e_espelhada(mascaras):
    invertida = mascaras["lateral"][:, ::-1]
    o = orientar_lateral(invertida)
    assert o.espelhada
    assert np.array_equal(o.aplicar(invertida), mascaras["lateral"])


def test_silhueta_simetrica_nao_e_mexida_mas_avisa():
    elipse = np.zeros((100, 300), bool)
    yy, xx = np.mgrid[:100, :300]
    elipse[((yy - 50) / 40) ** 2 + ((xx - 150) / 140) ** 2 < 1] = True
    o = orientar_topo(elipse)
    assert not o.alterada and not o.confiante


def test_aplicar_funciona_em_foto_colorida():
    foto = np.arange(2 * 3 * 3, dtype=np.uint8).reshape(2, 3, 3)
    saida = Orientacao(rotacao_90=1, espelhada=True).aplicar(foto)
    assert saida.shape == (3, 2, 3) and saida.flags["C_CONTIGUOUS"]


def test_pipeline_com_topo_em_pe_da_o_mesmo_modelo(fotos):
    """Regressão (tenis-02): topo em pé gerava um tênis de 78 cm de largura, sem aviso."""
    args = dict(comprimento_cm=28, resolucao=64, colorir=True)
    certo = processar(fotos["lateral"], fotos["topo"], fotos["frente"], **args)
    em_pe = processar(fotos["lateral"], np.rot90(fotos["topo"], -1).copy(), fotos["frente"], **args)
    assert np.allclose(certo.malha.extents, em_pe.malha.extents, atol=0.3)
    assert em_pe.metricas["orientacao"]["topo"]["rotacao_graus"] == 270  # anti-horário
    assert any("Giramos a foto de topo" in a for a in em_pe.avisos)
    assert not certo.avisos


def test_pipeline_com_lateral_invertida_avisa(fotos):
    r = processar(fotos["lateral"][:, ::-1].copy(), fotos["topo"], comprimento_cm=28, resolucao=48)
    assert r.metricas["orientacao"]["lateral"]["espelhada"]
    assert any("Espelhamos a foto lateral" in a for a in r.avisos)
