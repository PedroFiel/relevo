"""Visual hull implícito: distância assinada (SDF) por vista + Marching Cubes no nível 0."""

import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.alinhamento import alinhar_vistas, distancia_assinada
from relevo_pipeline.malha import campo_para_malha, voxels_para_malha
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos
from relevo_pipeline.voxel import campo_implicito, esculpir


@pytest.fixture(scope="module")
def vistas():
    fotos = gerar_fotos()
    m = {k: gerar_mascara(v) for k, v in fotos.items()}
    return alinhar_vistas(m["lateral"], m["topo"], m["frente"], resolucao=96)


def test_distancia_assinada_sinal_e_borda():
    m = np.zeros((50, 50), bool)
    m[10:40, 10:40] = True
    d = distancia_assinada(m)
    assert d[25, 25] < -10 and d[0, 0] > 10, "negativa dentro, positiva fora"
    assert d[25, 9] == pytest.approx(1) and d[25, 10] == pytest.approx(-1), "zero entre os pixels"


def test_campos_tem_o_formato_das_mascaras(vistas):
    for nome in ("lateral", "topo", "frente"):
        assert vistas.campos[nome].shape == getattr(vistas, nome).shape
        assert vistas.campos[nome].dtype == np.float32


def test_campo_negativo_coincide_com_o_hull_binario(vistas):
    """campo < 0 deve ser (quase) o mesmo conjunto de voxels da escultura binária."""
    dentro = campo_implicito(vistas) < 0
    binario = esculpir(vistas)
    assert dentro.shape == binario.shape
    assert (dentro == binario).mean() > 0.97


def test_malha_do_campo_e_fechada_e_em_escala_exata(vistas):
    malha = campo_para_malha(campo_implicito(vistas), comprimento_cm=27.5)
    assert malha.is_watertight
    assert malha.extents[0] == pytest.approx(27.5, abs=1e-4)
    assert malha.bounds[0][1] == pytest.approx(0, abs=1e-4), "apoiada no chão (y = 0)"


def _erro_normal_cilindro(malha) -> float:
    """Erro angular médio (graus) das normais na lateral de um cilindro deitado no eixo x."""
    c = malha.vertices
    yc = (malha.bounds[0][1] + malha.bounds[1][1]) / 2
    meio = (c[:, 0] > malha.bounds[0][0] + 7) & (c[:, 0] < malha.bounds[1][0] - 7)  # sem tampas
    r = np.hypot(c[meio, 1] - yc, c[meio, 2])
    radial = np.stack([np.zeros(meio.sum()), (c[meio, 1] - yc) / r, c[meio, 2] / r], axis=1)
    cos = np.clip((malha.vertex_normals[meio] * radial).sum(axis=1), -1, 1)
    return float(np.degrees(np.arccos(cos)).mean())


def test_campo_continuo_tira_os_degraus():
    """Cilindro (lateral e topo retangulares, frente circular): superfície conhecida.

    Os degraus de voxel aparecem como erro nas NORMAIS (listras no sombreamento). O campo
    contínuo deve errar bem menos que o hull binário — medido: 1,6° contra 3,3°.
    """
    lado = np.zeros((700, 2100), bool)
    lado[50:650, 50:2050] = True
    yy, xx = np.mgrid[:700, :700]
    frente = (yy - 349.5) ** 2 + (xx - 349.5) ** 2 < 300**2
    v = alinhar_vistas(lado, lado, frente, resolucao=96)
    suave = campo_para_malha(campo_implicito(v), comprimento_cm=28)
    degraus = voxels_para_malha(esculpir(v), comprimento_cm=28)
    assert abs(suave.volume - degraus.volume) / degraus.volume < 0.03
    assert _erro_normal_cilindro(suave) < 0.7 * _erro_normal_cilindro(degraus)
    assert _erro_normal_cilindro(suave) < 2.5


def test_campo_vazio_gera_erro():
    with pytest.raises(ValueError):
        campo_para_malha(np.ones((4, 4, 4), np.float32))


def test_pipeline_sai_com_o_comprimento_pedido():
    fotos = gerar_fotos()
    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=26, resolucao=64)
    assert r.malha.extents[0] == pytest.approx(26, abs=1e-4)
