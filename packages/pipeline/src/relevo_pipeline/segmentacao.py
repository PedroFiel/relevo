"""Etapa 1 — Segmentação clássica (sem IA): separa o objeto do fundo.

Técnicas de processamento de imagem usadas:
- Conversão para tons de cinza + desfoque gaussiano (reduz ruído)
- Limiarização automática de Otsu (escolhe o limiar que melhor separa 2 classes)
- Decisão de polaridade pela borda da imagem (a borda é quase toda fundo)
- Morfologia matemática: fechamento (fecha buracos pequenos) e abertura (remove ruído)
- Maior componente conexa + preenchimento de buracos internos (flood fill)
"""

from __future__ import annotations

import cv2
import numpy as np


def carregar_imagem(caminho: str) -> np.ndarray:
    """Lê uma imagem do disco em BGR (padrão OpenCV)."""
    img = cv2.imread(caminho, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Não foi possível abrir a imagem: {caminho}")
    return img


def gerar_mascara(img_bgr: np.ndarray, kernel: int = 5) -> np.ndarray:
    """Retorna máscara booleana (True = objeto) de uma foto em fundo liso."""
    cinza = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    cinza = cv2.GaussianBlur(cinza, (5, 5), 0)

    _, binaria = cv2.threshold(cinza, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Polaridade: se a maior parte da borda virou "branco", o branco é fundo -> inverte.
    borda = np.concatenate([binaria[0, :], binaria[-1, :], binaria[:, 0], binaria[:, -1]])
    if borda.mean() > 127:
        binaria = cv2.bitwise_not(binaria)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel))
    binaria = cv2.morphologyEx(binaria, cv2.MORPH_CLOSE, k, iterations=2)
    binaria = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, k, iterations=1)

    binaria = _maior_componente(binaria)
    binaria = _preencher_buracos(binaria)
    return binaria > 0


def _maior_componente(binaria: np.ndarray) -> np.ndarray:
    n, rotulos, stats, _ = cv2.connectedComponentsWithStats(binaria, connectivity=8)
    if n <= 1:
        return binaria
    maior = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(rotulos == maior, 255, 0).astype(np.uint8)


def _preencher_buracos(binaria: np.ndarray) -> np.ndarray:
    h, w = binaria.shape
    preenchida = binaria.copy()
    mascara_ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(preenchida, mascara_ff, (0, 0), 255)  # pinta o fundo a partir do canto
    buracos = cv2.bitwise_not(preenchida)
    return cv2.bitwise_or(binaria, buracos)
