"""Testes de UV + textura (F4-T06), níveis de detalhe LOD (F5-T02) e desempenho (F1-T09)."""

from __future__ import annotations

import time

import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.malha import gerar_lods
from relevo_pipeline.sintetico import gerar_fotos
from relevo_pipeline.textura import areas_uv, assar_textura, desdobrar_uv


@pytest.fixture(scope="module")
def resultado_sintetico():
    fotos = gerar_fotos()
    return fotos, processar(
        fotos["lateral"],
        fotos["topo"],
        fotos["frente"],
        comprimento_cm=28,
        resolucao=64,
        faces_alvo=2000,
    )


def test_uv_dentro_do_intervalo_unitario_e_sem_area_zero(resultado_sintetico):
    _, r = resultado_sintetico
    vmapping, faces_uv, uvs = desdobrar_uv(r.malha)
    assert len(vmapping) == 3 * len(r.malha.faces)
    assert uvs.shape == (3 * len(r.malha.faces), 2)
    assert np.all(uvs >= 0.0) and np.all(uvs <= 1.0)
    areas = areas_uv(faces_uv, uvs)
    assert np.all(areas > 1e-10)


def test_assar_textura_sem_pixels_pretos_e_com_dilatacao(resultado_sintetico):
    fotos, r = resultado_sintetico
    malha_uv, textura, metricas = assar_textura(
        r.malha, fotos, r.vistas, tamanho=256, dilatacao_px=4
    )
    assert textura.shape == (256, 256, 3)
    assert metricas["ilhas"] == 6
    assert metricas["faces_area_zero"] == 0
    assert metricas["cobertura_pct"] > 5.0
    # Nenhum pixel preto puro (0, 0, 0) na textura final (ilhas + borda dilatada + fundo neutro)
    pretos = np.all(textura == 0, axis=-1)
    assert not pretos.any()
    assert malha_uv.visual.kind == "texture"


def test_gerar_lods_produz_tres_niveis_decrescentes_e_fechados(resultado_sintetico):
    _, r = resultado_sintetico
    lods = gerar_lods(r.malha, fracoes=(1.0, 0.25, 0.05))
    assert len(lods) == 3
    assert [n["nivel"] for n in lods] == [0, 1, 2]
    assert lods[0]["faces"] > lods[1]["faces"] > lods[2]["faces"]
    for n in lods:
        assert n["malha"].is_watertight
        assert n["malha"].visual.kind == "vertex"


@pytest.mark.lento
def test_desempenho_configuracao_padrao_abaixo_de_15s():
    fotos = gerar_fotos()
    t0 = time.perf_counter()
    r = processar(
        fotos["lateral"],
        fotos["topo"],
        fotos["frente"],
        comprimento_cm=28.0,
        resolucao=128,
        faces_alvo=20_000,
    )
    duracao = time.perf_counter() - t0
    assert duracao < 15.0
    assert r.metricas["fechada"] is True
    assert sum(r.tempos_s.values()) <= duracao + 0.5
