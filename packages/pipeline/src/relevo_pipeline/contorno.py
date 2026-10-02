"""Etapa 1c — Rastreamento do contorno da silhueta (borda da máscara -> polígono).

Rastrear (seguir) um contorno é andar pela borda do objeto, pixel a pixel, sempre mantendo o
fundo do mesmo lado — como quem contorna um lago com a mão esquerda na água.

- `rastrear_contorno`: produção, com `cv2.findContours` (algoritmo de seguimento de borda de
  Suzuki & Abe, 1985), maior contorno externo.
- `rastrear_moore`: versão didática da **vizinhança de Moore** (critério de parada de Jacob):
  a partir de um pixel de borda, examina os 8 vizinhos no sentido horário começando pelo
  vizinho de onde veio; o primeiro pixel do objeto encontrado é o próximo da borda. O laço é por
  pixel DA BORDA (O(perímetro)) — exceção consciente à regra de vetorização.
- `simplificar`: **Douglas–Peucker** (`cv2.approxPolyDP`): mantém só os pontos que se afastam da
  reta entre os vizinhos mais que a tolerância — o contorno de milhares de pixels vira um polígono
  de algumas dezenas de vértices que ainda "abraça" o tênis.

Os pontos saem como (x, y) no CENTRO dos pixels (coordenadas contínuas, ver ajuste.py).
"""

from __future__ import annotations

import cv2
import numpy as np

TOLERANCIA_RELATIVA = 0.002  # tolerância do Douglas–Peucker = 0,2 % do perímetro

# Os 8 vizinhos em sentido horário (na imagem, y cresce para baixo), começando pelo oeste
VIZINHOS = [(-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]  # (dx, dy)


def rastrear_contorno(mascara: np.ndarray) -> np.ndarray:
    """Maior contorno externo: (N, 2) em (x, y) de centro de pixel; vazio se não houver."""
    contornos, _ = cv2.findContours(
        mascara.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE
    )
    if not contornos:
        return np.zeros((0, 2))
    maior = max(contornos, key=cv2.contourArea)
    return maior[:, 0, :].astype(np.float64) + 0.5


def rastrear_moore(mascara: np.ndarray) -> np.ndarray:
    """Versão didática (vizinhança de Moore + critério de parada de Jacob).

    Guarda o pixel atual `p` e o pixel de FUNDO `b` de onde chegamos. Examina os 8 vizinhos de `p`
    em sentido horário a partir de `b`; o primeiro pixel do objeto vira o novo `p` e o vizinho
    examinado logo antes dele (fundo) vira o novo `b`. Para quando volta ao início entrando pelo
    mesmo `b` (Jacob) — só "voltar ao início" falha em partes de 1 pixel de largura.
    """
    m = np.pad(mascara.astype(bool), 1)  # borda de fundo: nunca sai da imagem
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        return np.zeros((0, 2))
    # Início: primeiro pixel do objeto na varredura linha a linha; o vizinho a oeste é fundo.
    inicio = (int(xs[0]), int(ys[0]))
    b_inicio = (inicio[0] - 1, inicio[1])
    p, b = inicio, b_inicio
    borda = []
    while True:
        borda.append(p)
        k0 = VIZINHOS.index((b[0] - p[0], b[1] - p[1]))
        anterior = b
        for passo in range(1, 9):
            dx, dy = VIZINHOS[(k0 + passo) % 8]
            c = (p[0] + dx, p[1] + dy)
            if m[c[1], c[0]]:
                p, b = c, anterior
                break
            anterior = c
        else:  # pixel isolado: o contorno é ele mesmo
            break
        if p == inicio and b == b_inicio:
            break
    return np.array(borda, np.float64) - 1 + 0.5  # desfaz o pad e vai para o centro do pixel


def simplificar(contorno: np.ndarray, tolerancia_px: float | None = None) -> np.ndarray:
    """Douglas–Peucker. Tolerância padrão: 0,2 % do perímetro (mínimo 1 px)."""
    if len(contorno) < 3:
        return contorno
    c = contorno.astype(np.float32).reshape(-1, 1, 2)
    if tolerancia_px is None:
        tolerancia_px = max(1.0, TOLERANCIA_RELATIVA * cv2.arcLength(c, closed=True))
    return cv2.approxPolyDP(c, tolerancia_px, closed=True)[:, 0, :].astype(np.float64)


def medidas(contorno: np.ndarray) -> dict[str, float]:
    """Perímetro e área (fórmula do laço de Gauss) do polígono fechado, em pixels."""
    if len(contorno) < 3:
        return {"perimetro_px": 0.0, "area_px": 0.0}
    x, y = contorno[:, 0], contorno[:, 1]
    proximo = np.roll(contorno, -1, axis=0)
    perimetro = float(np.linalg.norm(proximo - contorno, axis=1).sum())
    area = float(0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))
    return {"perimetro_px": round(perimetro, 1), "area_px": round(area, 1)}
