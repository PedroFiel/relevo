"""Gera fotos sintéticas de um "tênis" (forma implícita) nas 3 vistas.

Serve para testes automatizados e para demonstrar o pipeline sem precisar de fotos reais.
As 3 imagens são projeções ortográficas do MESMO objeto 3D, com escalas e margens diferentes
(como aconteceria com fotos de verdade), então o pipeline precisa alinhá-las.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

COR_FUNDO = (235, 235, 235)  # BGR claro
COR_OBJETO = (60, 50, 170)  # BGR vermelho escuro


def tenis_implicito(n: int = 160) -> np.ndarray:
    """Ocupação booleana (L, H, W) de uma forma parecida com um tênis. x: calcanhar->bico."""
    L, H, W = n, int(n * 0.45), int(n * 0.4)
    x = np.linspace(0, 1, L)[:, None, None]
    y = np.linspace(0, 0.45, H)[None, :, None]
    z = np.linspace(-0.2, 0.2, W)[None, None, :]

    largura = (
        0.36 * np.clip(np.sin(np.pi * (0.05 + 0.9 * x)), 0, None) ** 0.5
    )  # estreito nas pontas
    altura = 0.12 + 0.26 * np.exp(-(((x - 0.18) / 0.22) ** 2))  # cano alto no calcanhar
    afinamento = 1 - 0.5 * (y / altura) ** 2  # mais estreito no topo
    return (y < altura) & (np.abs(z) < (largura / 2) * afinamento)


def _renderizar(mascara: np.ndarray, px_por_unidade: float, margem: int) -> np.ndarray:
    h, w = mascara.shape
    alvo = (int(w * px_por_unidade), int(h * px_por_unidade))
    m = cv2.resize(mascara.astype(np.uint8), alvo, interpolation=cv2.INTER_NEAREST)
    img = np.full((m.shape[0] + 2 * margem, m.shape[1] + 2 * margem, 3), COR_FUNDO, np.uint8)
    img[margem:-margem, margem:-margem][m > 0] = COR_OBJETO
    ruido = np.random.default_rng(0).normal(0, 4, img.shape)
    return np.clip(img + ruido, 0, 255).astype(np.uint8)


def gerar_fotos(n: int = 160) -> dict[str, np.ndarray]:
    occ = tenis_implicito(n)  # (L, H, W)
    lateral = occ.any(axis=2).T[::-1, :]  # (H, L), topo da imagem = topo do sapato
    topo = occ.any(axis=1).T  # (W, L)
    frente = occ.any(axis=0)[::-1, :]  # (H, W)
    return {
        "lateral": _renderizar(lateral, 5.0, 80),
        "topo": _renderizar(topo, 3.5, 60),
        "frente": _renderizar(frente, 4.0, 70),
    }


def salvar_fotos(pasta: str | Path, n: int = 160) -> dict[str, Path]:
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    caminhos = {}
    for nome, img in gerar_fotos(n).items():
        caminho = pasta / f"{nome}.png"
        cv2.imwrite(str(caminho), img)
        caminhos[nome] = caminho
    return caminhos
