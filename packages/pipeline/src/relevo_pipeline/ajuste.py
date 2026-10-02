"""Etapa 0 — Ajuste da foto pelo usuário: rotação (90° em 90°) e recorte (região de interesse).

Transformações 2D em coordenadas homogêneas: um ponto (x, y) vira (x, y, 1) e qualquer
combinação de rotação, espelhamento e translação vira uma matriz 3×3. Compor transformações é
multiplicar matrizes (a da direita é aplicada primeiro).

Usamos coordenadas CONTÍNUAS de pixel: o pixel (coluna i, linha j) ocupa o quadrado
[i, i+1) × [j, j+1) e seu centro é (i + 0,5, j + 0,5). Assim a rotação de uma imagem w × h
é exata (os cantos vão para os cantos).

Ordem: primeiro gira, depois recorta — o retângulo do recorte é dado na foto JÁ GIRADA, que é o
que o usuário vê no editor. Guardamos a matriz `M` que leva um ponto da foto ajustada de volta à
original (usada para desenhar o contorno sobre a foto que o usuário enviou).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

LADO_MINIMO_PX = 64
ROTACOES = (0, 90, 180, 270)


@dataclass(frozen=True)
class AjusteFoto:
    """`rotacao_graus` no sentido HORÁRIO; `recorte` = (x, y, largura, altura) na foto já girada."""

    rotacao_graus: int = 0
    recorte: tuple[int, int, int, int] | None = None

    @classmethod
    def de_dict(cls, d: dict) -> AjusteFoto:
        recorte = d.get("recorte")
        return cls(
            rotacao_graus=int(d.get("rotacao_graus", 0)),
            recorte=tuple(int(v) for v in recorte) if recorte is not None else None,
        )

    def para_dict(self) -> dict:
        recorte = list(self.recorte) if self.recorte else None
        return {"rotacao_graus": self.rotacao_graus, "recorte": recorte}


def translacao(tx: float, ty: float) -> np.ndarray:
    return np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1]], np.float64)


def matriz_rotacao_inversa(graus: int, largura: int, altura: int) -> np.ndarray:
    """Leva um ponto da imagem GIRADA (horário) de volta à imagem original de `largura` × `altura`.

    Ex.: girando 90° no horário, a coluna x da girada vem da linha `altura − x` da original e a
    linha y vem da coluna y — ou seja, (x_orig, y_orig) = (y, altura − x).
    """
    w, h = largura, altura
    match graus % 360:
        case 0:
            return np.eye(3)
        case 90:
            return np.array([[0, 1, 0], [-1, 0, h], [0, 0, 1]], np.float64)
        case 180:
            return np.array([[-1, 0, w], [0, -1, h], [0, 0, 1]], np.float64)
        case 270:
            return np.array([[0, -1, w], [1, 0, 0], [0, 0, 1]], np.float64)
    raise ValueError(f"Rotação inválida: {graus}°. Use 0, 90, 180 ou 270.")


def girar(img: np.ndarray, graus: int) -> np.ndarray:
    """Gira no sentido horário (múltiplos de 90°, sem interpolação)."""
    k = (graus % 360) // 90
    return np.ascontiguousarray(np.rot90(img, -k))  # rot90 positivo é anti-horário


def limitar_recorte(
    recorte: tuple[int, int, int, int], largura: int, altura: int
) -> tuple[int, int, int, int]:
    """Recorta o retângulo contra os limites da imagem (interseção de retângulos)."""
    x, y, w, h = recorte
    if w < 0:  # arrastado "ao contrário" no editor
        x, w = x + w, -w
    if h < 0:
        y, h = y + h, -h
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(largura, x + w), min(altura, y + h)
    if x1 - x0 < LADO_MINIMO_PX or y1 - y0 < LADO_MINIMO_PX:
        raise ValueError(
            f"O recorte ficou pequeno demais (mínimo {LADO_MINIMO_PX} px de cada lado dentro da "
            "foto). Desenhe um retângulo maior em volta do tênis."
        )
    return x0, y0, x1 - x0, y1 - y0


def aplicar_ajuste(img: np.ndarray, ajuste: AjusteFoto | None) -> tuple[np.ndarray, np.ndarray]:
    """Gira e recorta a foto. Retorna (foto ajustada, M 3×3: ajustada -> original)."""
    if ajuste is None:
        return img, np.eye(3)
    if ajuste.rotacao_graus % 360 not in ROTACOES:
        raise ValueError(f"Rotação inválida: {ajuste.rotacao_graus}°. Use 0, 90, 180 ou 270.")
    h, w = img.shape[:2]
    M = matriz_rotacao_inversa(ajuste.rotacao_graus, w, h)
    saida = girar(img, ajuste.rotacao_graus)
    if ajuste.recorte is not None:
        hg, wg = saida.shape[:2]
        x, y, rw, rh = limitar_recorte(ajuste.recorte, wg, hg)
        saida = np.ascontiguousarray(saida[y : y + rh, x : x + rw])
        M = M @ translacao(x, y)  # primeiro desloca para a girada, depois desfaz a rotação
    return saida, M


def aplicar_matriz(M: np.ndarray, pontos: np.ndarray) -> np.ndarray:
    """Aplica a matriz 3×3 a pontos (N, 2) em coordenadas homogêneas."""
    homog = np.hstack([pontos, np.ones((len(pontos), 1))])
    return (homog @ M.T)[:, :2]


def ler_ajustes(d: dict) -> dict[str, AjusteFoto]:
    """`{"topo": {"rotacao_graus": 270, "recorte": [x, y, w, h]}}` -> AjusteFoto por vista."""
    return {vista: AjusteFoto.de_dict(v) for vista, v in d.items()}
