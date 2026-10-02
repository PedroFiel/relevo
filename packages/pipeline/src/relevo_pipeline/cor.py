"""Etapa 5 — Cor por vértice (projeção das fotos sobre a malha).

Ideia (projeção de textura simplificada): cada vértice é projetado de volta nas fotos e
herda a cor do pixel onde cai. Como as vistas são ortográficas, a projeção é só descartar
o eixo que a câmera não vê (o inverso do que o visual hull faz):

    lateral / outro_lado  enxergam (x, y) -> faces com normal +z / −z (sem a foto do outro
                                             lado, a lateral espelhada pinta os dois)
    topo / sola           enxergam (x, z) -> faces voltadas para cima / para baixo
    frente / tras         enxergam (z, y) -> faces voltadas para o bico / para o calcanhar

Quando um vértice é visto por mais de uma foto, as cores são misturadas com peso
|normal|^p (p alto: manda a foto que "olha de frente" para aquela parte da superfície).
Sem foto da sola, o solado fica com cor neutra; sem foto frontal/traseira, bico e calcanhar
ficam com a cor da lateral.

Detalhe importante: os pixels da borda da silhueta misturam cor do tênis com cor do fundo.
Por isso a foto é "estendida" antes de amostrar: os pixels de fora (e da faixa de 3 px
junto à borda) copiam a cor do pixel interno mais próximo (transformada de distância).
"""

from __future__ import annotations

import cv2
import numpy as np
import trimesh
from scipy import sparse

from relevo_pipeline.alinhamento import VistasAlinhadas
from relevo_pipeline.malha import PAD
from relevo_pipeline.vistas import VISTAS

COR_SOLADO = np.array([90, 90, 90], np.float32)  # RGB neutro para o que nenhuma foto vê
EXPOENTE_PESO = 4.0
# cos⁴ a partir do qual a foto é "de confiança" (cos 0,67 ≈ 48°): abaixo, mistura com os vizinhos
CONFIANCA_CHEIA = 0.2
PESO_RESERVA_LATERAL = 1e-3  # ≈ cos(80°)^4: só decide onde nenhuma foto vê de frente
FOLGA_BORDA_PX = 3
FOLGA_BORDA_RELATIVA = 0.01


def srgb_para_linear(c: np.ndarray) -> np.ndarray:
    """Curva sRGB -> linear (IEC 61966-2-1). Entrada e saída em 0..1."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def estender_cor(img_bgr: np.ndarray, mascara: np.ndarray, folga: int | None = None) -> np.ndarray:
    """Preenche o fundo e a faixa junto à borda com a cor do pixel interno mais próximo.

    A faixa acompanha o tamanho do tênis na foto (1 % do maior lado, mínimo 3 px): a borda de
    uma foto de catálogo tem 6–10 px de degradê (sombra suave + desfoque); 3 px fixos bastavam a
    1600 px mas deixavam o bico do tenis-03 (768 px) cinza-claro.
    """
    if folga is None:
        ys, xs = np.nonzero(mascara)
        lado = max(np.ptp(ys), np.ptp(xs)) if len(ys) else 0
        folga = max(FOLGA_BORDA_PX, round(FOLGA_BORDA_RELATIVA * lado))
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


def preencher_sem_foto(
    malha: trimesh.Trimesh, cores: np.ndarray, confianca: np.ndarray, iteracoes: int = 200
) -> np.ndarray:
    """Onde nenhuma foto vê a face de frente, a cor vem dos vizinhos (interpolação harmônica).

    Projetar uma foto numa face quase de lado (ângulo rasante) ESTICA uma tira fina de pixels da
    borda sobre uma área grande — o "borrão" branco no bico do tenis-03, que não tem foto frontal.
    Então misturamos: c = α·projetada + (1 − α)·média dos vizinhos na malha, com α = confiança da
    melhor foto (cos⁴ do ângulo) normalizada. Iterar isso (Jacobi) resolve a equação de Laplace
    discreta no grafo da malha: as faces bem fotografadas ficam fixas e a cor "escorre" delas para
    as que nenhuma foto viu.
    """
    alfa = np.clip(confianca / CONFIANCA_CHEIA, 0.0, 1.0)[:, None]
    if alfa.min() >= 1.0:
        return cores
    n = len(malha.vertices)
    a, b = malha.edges_unique[:, 0], malha.edges_unique[:, 1]
    adj = sparse.coo_matrix((np.ones(2 * len(a)), (np.r_[a, b], np.r_[b, a])), shape=(n, n)).tocsr()
    grau = np.asarray(adj.sum(axis=1)).ravel()
    media = sparse.diags(1.0 / np.maximum(grau, 1)) @ adj  # linha i: média dos vizinhos de i
    fixo = alfa * cores
    c = cores.copy()
    for _ in range(iteracoes):
        c = fixo + (1 - alfa) * (media @ c)
    return c


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
    ny = n[:, 1]

    def pixel(vista: str, u_frac: np.ndarray, v_frac: np.ndarray):
        """Fração (0..1) dentro da caixa de recorte -> linha/coluna na foto original."""
        y0, y1, x0, x1 = vistas.caixas[vista]
        return y0 + v_frac * (y1 - y0) - 0.5, x0 + u_frac * (x1 - x0) - 0.5

    cores, pesos = [], []

    def adicionar(vista: str, linhas, colunas, peso, reserva=0.0):
        img = estender_cor(fotos_bgr[vista], mascaras[vista])
        cores.append(_amostrar(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), linhas, colunas))
        pesos.append(peso**EXPOENTE_PESO + reserva)

    # Posição do vértice como fração (coluna u, linha v) no quadro canônico de cada vista:
    # lateral (y invertido: topo da foto = topo do tênis), topo (linhas = z), frente (colunas = z)
    fracao = {
        "lateral": (ix / L, 1 - iy / H),
        "topo": (ix / L, iz / W),
        "frente": (iz / W, 1 - iy / H),
    }
    for nome in vistas.mascaras:
        vista = VISTAS[nome]
        u, v = fracao[vista.quadro]
        espelha_colunas, espelha_linhas = vistas.espelhos[nome]  # quadro -> foto (é involução)
        u = 1 - u if espelha_colunas else u
        v = 1 - v if espelha_linhas else v
        linhas, colunas = pixel(nome, u, v)
        alinhamento = n @ np.array(vista.direcao, np.float64)
        if vista.quadro == "lateral" and len(vistas.do_quadro("lateral")) == 1:
            # Sem a foto do outro lado, a lateral pinta os dois lados (espelhada: na projeção
            # ortográfica, o ponto do outro lado cai no mesmo pixel)
            peso = np.abs(alinhamento)
        else:
            peso = np.clip(alinhamento, 0, None)
        # Calcanhar/bico sem foto própria: na dúvida, a cor vem da lateral (e não de uma média
        # de todas as fotos com peso ~0)
        reserva = PESO_RESERVA_LATERAL if vista.quadro == "lateral" else 0.0
        adicionar(nome, linhas, colunas, peso, reserva)

    if "sola" not in vistas.mascaras:
        # Nenhuma foto enxerga a parte de baixo -> cor neutra com peso crescente para baixo
        cores.append(np.broadcast_to(COR_SOLADO, (len(ix), 3)))
        pesos.append(np.clip(-ny, 0, None) ** EXPOENTE_PESO)

    pesos_m = np.stack(pesos, axis=1) + 1e-6  # (N, fontes); epsilon evita divisão por zero
    confianca = pesos_m.max(axis=1)  # o quanto a MELHOR foto vê esta face de frente
    pesos_m /= pesos_m.sum(axis=1, keepdims=True)
    mistura = sum(c * p[:, None] for c, p in zip(cores, pesos_m.T, strict=True))
    mistura = preencher_sem_foto(malha, mistura, confianca)
    rgb = np.clip(mistura, 0, 255).astype(np.uint8)

    # O glTF exige COLOR_0 em espaço LINEAR; as fotos estão em sRGB (curva gama ~2,2).
    # Sem essa conversão, os visualizadores mostram tudo "lavado" (vermelho vira rosa).
    linear = (srgb_para_linear(rgb.astype(np.float32) / 255) * 255 + 0.5).astype(np.uint8)
    malha.visual = trimesh.visual.ColorVisuals(
        mesh=malha, vertex_colors=np.hstack([linear, np.full((len(rgb), 1), 255, np.uint8)])
    )
    return rgb
