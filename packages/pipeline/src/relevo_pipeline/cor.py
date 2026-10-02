"""Etapa 5 — Cor por vértice (projeção das fotos sobre a malha).

Ideia (projeção de textura simplificada): cada vértice é projetado de volta nas fotos e
herda a cor do pixel onde cai. Como as vistas são ortográficas, a projeção é só descartar
o eixo que a câmera não vê (o inverso do que o visual hull faz):

    lateral enxerga (x, y)  -> usada onde a normal aponta para ±z (o lado de dentro usa a
                               foto lateral espelhada: mesma posição, mesma cor)
    topo    enxerga (x, z)  -> usada onde a normal aponta para cima (+y)
    frente  enxerga (z, y)  -> usada onde a normal aponta para o bico (+x)

Quando um vértice é visto por mais de uma foto, as cores são misturadas com peso
|normal|^p (p alto: manda a foto que "olha de frente" para aquela parte da superfície).
O solado (normal para baixo) e o calcanhar sem foto frontal ficam com a cor neutra / lateral.

Detalhe importante: os pixels da borda da silhueta misturam cor do tênis com cor do fundo.
Por isso a foto é "estendida" antes de amostrar: os pixels de fora (e da faixa de 3 px
junto à borda) copiam a cor do pixel interno mais próximo (transformada de distância).
"""

from __future__ import annotations

import cv2
import numpy as np
import trimesh

from relevo_pipeline.alinhamento import VistasAlinhadas
from relevo_pipeline.malha import PAD

COR_SOLADO = np.array([90, 90, 90], np.float32)  # RGB neutro para o que nenhuma foto vê
EXPOENTE_PESO = 4.0
FOLGA_BORDA_PX = 3


def srgb_para_linear(c: np.ndarray) -> np.ndarray:
    """Curva sRGB -> linear (IEC 61966-2-1). Entrada e saída em 0..1."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def estender_cor(
    img_bgr: np.ndarray, mascara: np.ndarray, folga: int = FOLGA_BORDA_PX
) -> np.ndarray:
    """Preenche o fundo e a faixa junto à borda com a cor do pixel interno mais próximo."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * folga + 1, 2 * folga + 1))
    interior = cv2.erode(mascara.astype(np.uint8), k)
    if not interior.any():  # objeto muito fino: usa a máscara inteira
        interior = mascara.astype(np.uint8)
    # distanceTransform mede a distância até o pixel ZERO mais próximo; os zeros aqui são os
    # pixels interiores. Com DIST_LABEL_PIXEL cada zero tem um rótulo próprio e os demais
    # pixels recebem o rótulo do zero mais próximo.
    _, rotulos = cv2.distanceTransformWithLabels(
        (interior == 0).astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL
    )
    yi, xi = np.nonzero(interior > 0)
    mapa_y = np.zeros(rotulos.max() + 1, np.int32)
    mapa_x = np.zeros(rotulos.max() + 1, np.int32)
    mapa_y[rotulos[yi, xi]] = yi
    mapa_x[rotulos[yi, xi]] = xi
    return img_bgr[mapa_y[rotulos], mapa_x[rotulos]]


def _amostrar(img_rgb: np.ndarray, linhas: np.ndarray, colunas: np.ndarray) -> np.ndarray:
    """Amostragem bilinear de cores em coordenadas de pixel (float), vetorizada."""
    h, w = img_rgb.shape[:2]
    y = np.clip(linhas, 0, h - 1)
    x = np.clip(colunas, 0, w - 1)
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    y1, x1 = np.minimum(y0 + 1, h - 1), np.minimum(x0 + 1, w - 1)
    fy, fx = (y - y0)[:, None], (x - x0)[:, None]
    img = img_rgb.astype(np.float32)
    topo = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    base = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return topo * (1 - fy) + base * fy


def colorir_malha(
    malha: trimesh.Trimesh,
    vistas: VistasAlinhadas,
    mascaras: dict[str, np.ndarray],
    fotos_bgr: dict[str, np.ndarray],
) -> np.ndarray:
    """Calcula e aplica a cor por vértice. Retorna as cores (N, 3) uint8 em sRGB (como as fotos)."""
    tv = malha.metadata["tamanho_voxel"]
    desl = np.array(malha.metadata["deslocamento"])
    L, H, W = vistas.dims

    # cm (já centrado/no chão) -> índice de voxel contínuo; +0.5: o centro do voxel i fica em i+0.5
    idx = (malha.vertices - desl) / tv - PAD + 0.5
    ix, iy, iz = idx[:, 0], idx[:, 1], idx[:, 2]
    n = malha.vertex_normals
    nx, ny, nz = n[:, 0], n[:, 1], n[:, 2]

    def pixel(vista: str, u_frac: np.ndarray, v_frac: np.ndarray):
        """Fração (0..1) dentro da caixa de recorte -> linha/coluna na foto original."""
        y0, y1, x0, x1 = vistas.caixas[vista]
        return y0 + v_frac * (y1 - y0) - 0.5, x0 + u_frac * (x1 - x0) - 0.5

    cores, pesos = [], []

    def adicionar(vista: str, linhas, colunas, peso):
        img = estender_cor(fotos_bgr[vista], mascaras[vista])
        cores.append(_amostrar(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), linhas, colunas))
        pesos.append(peso**EXPOENTE_PESO)

    # lateral: linhas = y (invertido: topo da foto = topo do tênis), colunas = x
    linhas, colunas = pixel("lateral", ix / L, 1 - iy / H)
    adicionar("lateral", linhas, colunas, np.abs(nz))

    # topo: linhas = z, colunas = x; só enxerga superfícies voltadas para cima
    linhas, colunas = pixel("topo", ix / L, iz / W)
    adicionar("topo", linhas, colunas, np.clip(ny, 0, None))

    # frente: linhas = y (invertido), colunas = z invertido (câmera olha o bico, -z fica à direita)
    if "frente" in vistas.caixas:
        linhas, colunas = pixel("frente", 1 - iz / W, 1 - iy / H)
        adicionar("frente", linhas, colunas, np.clip(nx, 0, None))

    # Solado: nenhuma foto enxerga a parte de baixo -> cor neutra com peso crescente para baixo
    cores.append(np.broadcast_to(COR_SOLADO, (len(ix), 3)))
    pesos.append(np.clip(-ny, 0, None) ** EXPOENTE_PESO)

    pesos_m = np.stack(pesos, axis=1) + 1e-6  # (N, fontes); epsilon evita divisão por zero
    pesos_m /= pesos_m.sum(axis=1, keepdims=True)
    mistura = sum(c * p[:, None] for c, p in zip(cores, pesos_m.T, strict=True))
    rgb = np.clip(mistura, 0, 255).astype(np.uint8)

    # O glTF exige COLOR_0 em espaço LINEAR; as fotos estão em sRGB (curva gama ~2,2).
    # Sem essa conversão, os visualizadores mostram tudo "lavado" (vermelho vira rosa).
    linear = (srgb_para_linear(rgb.astype(np.float32) / 255) * 255 + 0.5).astype(np.uint8)
    malha.visual = trimesh.visual.ColorVisuals(
        mesh=malha, vertex_colors=np.hstack([linear, np.full((len(rgb), 1), 255, np.uint8)])
    )
    return rgb
