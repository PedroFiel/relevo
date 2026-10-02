"""Avisos de qualidade da máscara (F1-T06) e consistência entre as vistas (F1-T07, parcial)."""

import cv2
import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.metricas import avisos_consistencia, iou
from relevo_pipeline.segmentacao import qualidade_mascara, segmentar
from relevo_pipeline.sintetico import gerar_fotos


@pytest.fixture(scope="module")
def fotos():
    return gerar_fotos()


def _foto(objeto: tuple[slice, slice], tamanho=(400, 600)) -> np.ndarray:
    img = np.full((*tamanho, 3), 235, np.uint8)
    img[objeto] = 30
    return img


def _avisos(img: np.ndarray) -> list[str]:
    mascara, bruta = segmentar(img)
    return qualidade_mascara(mascara, bruta, "lateral")


# ---------- qualidade_mascara ----------
def test_foto_boa_nao_gera_aviso():
    assert _avisos(_foto((slice(100, 300), slice(100, 500)))) == []


def test_tenis_cortado_na_borda():
    avisos = _avisos(_foto((slice(100, 300), slice(300, 600))))  # encosta na borda direita
    assert len(avisos) == 1 and "borda da foto lateral" in avisos[0]


def test_tenis_pequeno_demais():
    avisos = _avisos(_foto((slice(190, 220), slice(280, 330))))
    assert any("Aproxime" in a for a in avisos)


def test_tenis_grande_demais():
    avisos = _avisos(_foto((slice(10, 390), slice(10, 590))))
    assert any("Afaste um pouco" in a for a in avisos)


def test_objeto_extra_grande_avisa():
    img = _foto((slice(100, 300), slice(60, 330)))
    img[120:280, 400:540] = 30  # segundo objeto (sombra forte / caixa no fundo)
    mascara, bruta = segmentar(img)
    assert not mascara[200, 470], "a máscara final fica só com o maior objeto"
    assert any("mais de um objeto" in a for a in qualidade_mascara(mascara, bruta))


def test_mascara_vazia_avisa():
    assert "Não encontramos" in qualidade_mascara(np.zeros((10, 10), bool))[0]


# ---------- consistência entre vistas ----------
def test_iou():
    a = np.zeros((10, 10), bool)
    a[:, :5] = True
    b = np.zeros((10, 10), bool)
    b[:, 2:7] = True
    assert iou(a, a) == 1.0
    assert abs(iou(a, b) - 3 / 7) < 1e-9


def test_sintetico_e_consistente(fotos):
    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=28, resolucao=96)
    c = r.metricas["consistencia"]
    assert min(c["iou_lateral"], c["iou_topo"], c["iou_frente"]) > 0.90
    assert abs(c["razao_frente"] - 1) < 0.05
    assert r.avisos == []


def test_frente_esticada_30_porcento_avisa(fotos):
    """Critério da F1-T07: aviso de consistência quando a frente é esticada 30 %."""
    f = fotos["frente"]
    esticada = cv2.resize(f, (f.shape[1], round(f.shape[0] * 1.3)))
    r = processar(fotos["lateral"], fotos["topo"], esticada, comprimento_cm=28, resolucao=64)
    assert r.metricas["consistencia"]["razao_frente"] > 1.2
    assert any("foto frontal parece mais alta" in a for a in r.avisos)


def test_iou_baixo_avisa():
    avisos = avisos_consistencia({"iou_lateral": 0.97, "iou_topo": 0.80})
    assert len(avisos) == 1 and "topo" in avisos[0] and "lateral" not in avisos[0]


# ---------- Halo de sombra suave (tenis-03) ----------
def _objeto_com_sombra_suave(peca_clara: bool = False):
    """Fundo de catálogo perfeito (245, ruído zero), tênis preto e sombra em degradê de ~20 px."""
    h, w = 400, 600
    objeto = np.zeros((h, w), np.uint8)
    objeto[120:280, 100:500] = 1
    # Sombra que some com a distância à borda (perfil medido no tenis-03: −208 → −5 em ~20 px)
    d = cv2.distanceTransform(1 - objeto, cv2.DIST_L2, 5)
    img = (245 - 120 * np.exp(-d / 6.0)).astype(np.float32)
    img[objeto > 0] = 20
    if peca_clara:  # "solado" cinza-claro e LISO colado no preto (tenis-01): não é sombra
        img[280:330, 100:500] = 200
    img = cv2.GaussianBlur(img, (0, 0), 1.2)  # borda levemente desfocada, como numa foto
    return np.repeat(np.clip(img, 0, 255).astype(np.uint8)[..., None], 3, axis=2)


def test_halo_de_sombra_nao_incha_a_silhueta():
    m, _ = segmentar(_objeto_com_sombra_suave())
    ys, xs = np.nonzero(m)
    # sem a remoção, a máscara ia ~15 px além do objeto em cada lado
    assert xs.min() >= 100 - 4 and xs.max() <= 499 + 4
    assert ys.min() >= 120 - 4 and ys.max() <= 279 + 4


def test_peca_clara_e_lisa_colada_no_preto_continua():
    m, _ = segmentar(_objeto_com_sombra_suave(peca_clara=True))
    assert m[305, 300], "a peça cinza-clara (solado) faz parte do tênis"
    assert np.nonzero(m)[0].max() >= 325
