"""Rastreamento de contorno (F1-T12): Moore (didático) × Suzuki–Abe (OpenCV), Douglas–Peucker."""

import cv2
import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.ajuste import AjusteFoto
from relevo_pipeline.contorno import medidas, rastrear_contorno, rastrear_moore, simplificar
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos


def _elipse_com_braco():
    yy, xx = np.mgrid[:80, :120]
    m = ((yy - 40) / 30) ** 2 + ((xx - 60) / 45) ** 2 < 1
    m[38:41, 5:115] = True  # "braço" de 3 px de largura: caso difícil para o critério de parada
    m[20:28, 40:50] = False  # reentrância
    return m


@pytest.mark.parametrize("forma", ["quadrado", "elipse_com_braco"])
def test_moore_acha_os_mesmos_pixels_de_borda_que_o_opencv(forma):
    if forma == "quadrado":
        m = np.zeros((50, 50), bool)
        m[10:40, 10:40] = True
    else:
        m = _elipse_com_braco()
    moore, opencv = rastrear_moore(m), rastrear_contorno(m)
    assert set(map(tuple, moore)) == set(map(tuple, opencv))


def test_contorno_vazio_e_pixel_isolado():
    assert len(rastrear_contorno(np.zeros((5, 5), bool))) == 0
    m = np.zeros((5, 5), bool)
    m[2, 2] = True
    assert rastrear_moore(m).tolist() == [[2.5, 2.5]]


def test_douglas_peucker_reduz_pontos_sem_se_afastar_da_borda():
    yy, xx = np.mgrid[:400, :400]
    m = (yy - 200) ** 2 + (xx - 200) ** 2 < 150**2
    cheio = rastrear_contorno(m)
    simples = simplificar(cheio)
    assert len(simples) < 0.1 * len(cheio)
    # todo ponto do contorno original fica a no máximo ~tolerância do polígono simplificado
    poligono = simples.astype(np.float32).reshape(-1, 1, 2)
    dist = [abs(cv2.pointPolygonTest(poligono, (float(x), float(y)), True)) for x, y in cheio]
    assert max(dist) < 0.002 * 2 * np.pi * 150 + 1


def test_medidas_de_um_quadrado():
    q = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], float)
    assert medidas(q) == {"perimetro_px": 400.0, "area_px": 10000.0}


def test_contorno_volta_para_a_foto_original_mesmo_com_rotacao_e_recorte():
    """Os pontos do contorno (na foto ORIGINAL) ficam na borda da máscara da original."""
    fotos = gerar_fotos()
    topo = fotos["topo"]
    h, w = topo.shape[:2]
    topo_em_pe = np.rot90(topo, 1).copy()  # o usuário enviou em pé...
    ajuste = AjusteFoto(90, (10, 5, w - 20, h - 10))  # ...e girou + recortou no editor
    r = processar(fotos["lateral"], topo_em_pe, comprimento_cm=28, resolucao=48,
                  colorir=False, ajustes={"topo": ajuste})  # fmt: skip
    pontos = np.array(r.contornos["topo"]["pontos"])
    borda = gerar_mascara(topo_em_pe).astype(np.uint8)
    borda = borda - cv2.erode(borda, np.ones((3, 3), np.uint8))
    dist = cv2.distanceTransform(1 - borda, cv2.DIST_L2, 3)
    perto = dist[pontos[:, 1].astype(int), pontos[:, 0].astype(int)] <= 2
    assert perto.mean() > 0.98
    assert abs(r.contornos["topo"]["area_px"] / gerar_mascara(topo_em_pe).sum() - 1) < 0.03
