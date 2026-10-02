"""Etapa 2 — Alinhamento/normalização das 3 silhuetas numa grade comum.

Cada foto enxerga 2 dos 3 eixos:
    lateral -> (altura y, comprimento x)   linhas = y (topo da foto = topo do sapato), colunas = x
    topo    -> (largura z, comprimento x)  linhas = z, colunas = x
    frente  -> (altura y, largura z)       linhas = y, colunas = z

As dimensões em comum precisam bater:
    comprimento: lateral == topo
    altura:      lateral == frente
    largura:     topo    == frente

Estratégia: recorta cada máscara justa no objeto (bounding box), fixa o comprimento em
`resolucao` voxels e deriva altura e largura pelas proporções das fotos lateral e de topo.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class VistasAlinhadas:
    lateral: np.ndarray  # (H, L) bool
    topo: np.ndarray  # (W, L) bool
    frente: np.ndarray | None  # (H, W) bool
    dims: tuple[int, int, int]  # (L, H, W) em voxels
    # Caixa de recorte de cada máscara na foto original: (linha0, linha1, coluna0, coluna1).
    # Permite voltar de um voxel para o pixel da foto (usado na cor por vértice).
    caixas: dict[str, tuple[int, int, int, int]] = field(default_factory=dict)


def caixa_objeto(mascara: np.ndarray) -> tuple[int, int, int, int]:
    """Bounding box do objeto: (linha0, linha1, coluna0, coluna1), limites exclusivos no fim."""
    ys, xs = np.nonzero(mascara)
    if len(ys) == 0:
        raise ValueError("Máscara vazia: nenhum objeto encontrado na foto.")
    return int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1


def recortar(mascara: np.ndarray) -> np.ndarray:
    """Recorta a máscara na bounding box do objeto."""
    y0, y1, x0, x1 = caixa_objeto(mascara)
    return mascara[y0:y1, x0:x1]


def redimensionar(mascara: np.ndarray, linhas: int, colunas: int) -> np.ndarray:
    m = cv2.resize(mascara.astype(np.uint8) * 255, (colunas, linhas), interpolation=cv2.INTER_AREA)
    return m > 127


def alinhar_vistas(
    lateral: np.ndarray,
    topo: np.ndarray,
    frente: np.ndarray | None = None,
    resolucao: int = 128,
) -> VistasAlinhadas:
    lat = recortar(lateral)
    top = recortar(topo)

    L = resolucao
    H = max(2, round(L * lat.shape[0] / lat.shape[1]))
    W = max(2, round(L * top.shape[0] / top.shape[1]))

    lat_n = redimensionar(lat, H, L)
    top_n = redimensionar(top, W, L)
    fre_n = redimensionar(recortar(frente), H, W) if frente is not None else None
    caixas = {"lateral": caixa_objeto(lateral), "topo": caixa_objeto(topo)}
    if frente is not None:
        caixas["frente"] = caixa_objeto(frente)
    return VistasAlinhadas(lateral=lat_n, topo=top_n, frente=fre_n, dims=(L, H, W), caixas=caixas)
