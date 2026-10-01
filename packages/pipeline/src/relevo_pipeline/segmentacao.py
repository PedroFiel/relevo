"""Etapa 1 — Segmentação clássica (sem IA): separa o objeto do fundo.

Técnicas de processamento de imagem usadas:
- Filtro de mediana (tira ruído sem alargar bordas)
- Espaço de cor CIE Lab (a distância euclidiana ali se aproxima da diferença percebida pelo olho)
- Cor do fundo estimada pela mediana da borda da imagem (a borda é quase toda fundo)
- Distância de cor de cada pixel ao fundo + limiar adaptativo ao ruído da borda
  (acha tanto o tênis escuro quanto o solado branco em fundo cinza claro; só o brilho,
  como no Otsu, confundia o branco do solado com o fundo)
- Morfologia matemática: fechamento (fecha buracos pequenos) e abertura (remove ruído e a
  faixa fina de sombra de contato sob o solado)
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


def _distancia_ao_fundo(img_bgr: np.ndarray) -> tuple[np.ndarray, float]:
    """Distância de cada pixel à cor do fundo (Lab) e o ruído típico do fundo."""
    # Mediana (e não gaussiano): tira o ruído sem "alargar" as bordas do objeto
    lab = cv2.cvtColor(cv2.medianBlur(img_bgr, 5), cv2.COLOR_BGR2LAB).astype(np.float32)

    h, w = lab.shape[:2]
    e = max(3, round(0.01 * min(h, w)))  # faixa de borda de ~1% da imagem
    borda = np.concatenate(
        [lab[:e].reshape(-1, 3), lab[-e:].reshape(-1, 3),
         lab[:, :e].reshape(-1, 3), lab[:, -e:].reshape(-1, 3)]
    )  # fmt: skip
    fundo = np.median(borda, axis=0)  # mediana ignora molduras finas e cantos sujos
    dist = np.linalg.norm(lab - fundo, axis=2)

    # mediana: aguenta até ~50% da borda suja (ex.: moldura escura de uma captura de tela)
    ruido = float(np.median(np.linalg.norm(borda - fundo, axis=1)))
    return dist, ruido


def gerar_mascara(img_bgr: np.ndarray, kernel: int = 5, limiar: float | None = None) -> np.ndarray:
    """Retorna máscara booleana (True = objeto) de uma foto em fundo liso.

    `limiar` é a distância mínima (em Lab) ao fundo para um pixel contar como objeto.
    Padrão: 4x o ruído do fundo, entre 10 e 30.
    """
    dist, ruido = _distancia_ao_fundo(img_bgr)
    if limiar is None:
        limiar = float(np.clip(4.0 * ruido, 10.0, 30.0))
    binaria = ((dist > limiar) * 255).astype(np.uint8)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel))
    binaria = cv2.morphologyEx(binaria, cv2.MORPH_CLOSE, k, iterations=2)
    # Abertura proporcional à imagem: remove ruído e a sombra de contato (faixa escura fina
    # sob o solado) sem comer o objeto, que é grande perto dela.
    lado = max(kernel, round(0.015 * min(binaria.shape)))
    k_grande = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (lado, lado))
    binaria = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, k_grande, iterations=1)

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
