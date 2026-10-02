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

Além da máscara reduzida (0/1), cada vista ganha um **campo de distância assinada** (SDF 2D):
para cada ponto, a distância até a borda da silhueta — negativa dentro, positiva fora — medida
na foto em resolução cheia e depois reamostrada para a grade. Esse campo contínuo guarda a
posição da borda com precisão de fração de voxel e evita os "degraus" na malha (ver voxel.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from relevo_pipeline.vistas import EIXO_LIVRE, PRINCIPAL, VISTAS, validar_nomes

SUAVIZACAO_BORDA_VOXEL = 1.0  # desvio do desfoque da SDF 2D, em voxels da grade


@dataclass
class VistasAlinhadas:
    dims: tuple[int, int, int]  # (L, H, W) em voxels
    # Máscara de cada vista JÁ NO QUADRO CANÔNICO (ver vistas.py): lateral/outro_lado (H, L),
    # topo/sola (W, L), frente/tras (H, W)
    mascaras: dict[str, np.ndarray] = field(default_factory=dict)
    # Distância assinada à borda de cada silhueta, em voxels, no mesmo formato/quadro das máscaras
    campos: dict[str, np.ndarray] = field(default_factory=dict)
    # Caixa do objeto em cada foto (ajustada/orientada): (linha0, linha1, coluna0, coluna1).
    # Permite voltar de um voxel para o pixel da foto (usado na cor por vértice).
    caixas: dict[str, tuple[int, int, int, int]] = field(default_factory=dict)
    # Espelhamentos foto -> quadro efetivamente usados: (colunas, linhas)
    espelhos: dict[str, tuple[bool, bool]] = field(default_factory=dict)
    # Vistas extras cujo espelhamento foi trocado pelo registro (foto do outro pé, por exemplo)
    registradas: list[str] = field(default_factory=list)

    @property
    def lateral(self) -> np.ndarray:
        return self.mascaras["lateral"]

    @property
    def topo(self) -> np.ndarray:
        return self.mascaras["topo"]

    @property
    def frente(self) -> np.ndarray | None:
        return self.mascaras.get("frente")

    def do_quadro(self, quadro: str) -> list[str]:
        """Nomes das vistas presentes num quadro canônico."""
        return [n for n in self.mascaras if VISTAS[n].quadro == quadro]

    def formato(self, quadro: str) -> tuple[int, int]:
        L, H, W = self.dims
        return {"lateral": (H, L), "topo": (W, L), "frente": (H, W)}[quadro]


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


def distancia_assinada(mascara: np.ndarray) -> np.ndarray:
    """SDF 2D em pixels: negativa dentro da silhueta, positiva fora, zero na borda.

    distanceTransform dá, para cada pixel não-nulo, a distância ao pixel nulo mais próximo.
    Fazemos isso para fora (fundo -> objeto) e para dentro (objeto -> fundo) e subtraímos;
    os pixels vizinhos à borda ficam com +1 e -1, então o zero cai exatamente entre eles.
    """
    m = mascara.astype(np.uint8)
    fora = cv2.distanceTransform(1 - m, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    dentro = cv2.distanceTransform(m, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    return fora - dentro


def campo_na_grade(mascara: np.ndarray, linhas: int, colunas: int) -> np.ndarray:
    """SDF da silhueta (na resolução da foto) recortada na caixa do objeto e levada à grade.

    Calculado na foto inteira (e não no recorte) para a distância fora do objeto sair certa.
    A interpolação bilinear do cv2.resize alinha centros de pixel com centros de voxel.
    """
    y0, y1, x0, x1 = caixa_objeto(mascara)
    escala = np.sqrt(linhas / (y1 - y0) * colunas / (x1 - x0))  # pixels -> voxels
    sdf = distancia_assinada(mascara)
    # Passa-baixa na borda: o ruído da segmentação (1–3 px de serrilhado e de JPEG) vira, na
    # escala da grade, ondulações de fração de voxel que aparecem como listras no sombreamento.
    # Um desfoque de ~1 voxel (medido na foto) tira isso sem mexer em detalhes maiores.
    sigma_px = SUAVIZACAO_BORDA_VOXEL / escala
    if sigma_px > 0.5:
        sdf = cv2.GaussianBlur(sdf, (0, 0), sigma_px)
    campo = cv2.resize(sdf[y0:y1, x0:x1], (colunas, linhas), interpolation=cv2.INTER_LINEAR)
    return (campo * escala).astype(np.float32)


def _espelhar(m: np.ndarray, colunas: bool, linhas: bool) -> np.ndarray:
    if colunas:
        m = m[:, ::-1]
    if linhas:
        m = m[::-1, :]
    return np.ascontiguousarray(m)


def iou(a: np.ndarray, b: np.ndarray) -> float:
    uniao = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / uniao) if uniao else 1.0


MARGEM_REGISTRO = 0.01  # o espelhamento alternativo precisa ganhar por pelo menos isso de IoU


def alinhar_vistas(
    lateral: np.ndarray,
    topo: np.ndarray,
    frente: np.ndarray | None = None,
    resolucao: int = 128,
    extras: dict[str, np.ndarray] | None = None,
) -> VistasAlinhadas:
    """Leva todas as silhuetas para a grade comum, cada uma no seu quadro canônico.

    `extras`: máscaras das vistas opcionais (outro_lado, sola, tras) nas fotos já ajustadas.
    Cada extra é **registrada** contra a principal do seu quadro: testamos o espelhamento físico e
    o oposto no eixo livre e ficamos com o de maior IoU (protege contra, por exemplo, a foto da
    sola ter sido tirada do outro pé do par, que é a imagem espelhada).
    """
    fotos = {"lateral": lateral, "topo": topo}
    if frente is not None:
        fotos["frente"] = frente
    fotos.update(extras or {})
    validar_nomes(fotos)

    lat, top = recortar(lateral), recortar(topo)
    L = resolucao
    H = max(2, round(L * lat.shape[0] / lat.shape[1]))
    W = max(2, round(L * top.shape[0] / top.shape[1]))
    v = VistasAlinhadas(dims=(L, H, W))

    # Principais primeiro: as extras são registradas contra elas
    ordem = sorted(fotos, key=lambda n: n not in PRINCIPAL.values())
    for nome in ordem:
        m, vista = fotos[nome], VISTAS[nome]
        linhas, colunas = v.formato(vista.quadro)
        mascara = redimensionar(recortar(m), linhas, colunas)
        campo = campo_na_grade(m, linhas, colunas)
        esp = [vista.espelhar_colunas, vista.espelhar_linhas]
        principal = PRINCIPAL[vista.quadro]
        if nome != principal and principal in v.mascaras:
            eixo = EIXO_LIVRE[vista.quadro]
            alternativo = esp.copy()
            alternativo[eixo] = not alternativo[eixo]
            ref = v.mascaras[principal]
            if (
                iou(_espelhar(mascara, *alternativo), ref)
                > iou(_espelhar(mascara, *esp), ref) + MARGEM_REGISTRO
            ):
                esp = alternativo
                v.registradas.append(nome)
        v.mascaras[nome] = _espelhar(mascara, *esp)
        v.campos[nome] = _espelhar(campo, *esp)
        v.caixas[nome] = caixa_objeto(m)
        v.espelhos[nome] = (esp[0], esp[1])
    return v
