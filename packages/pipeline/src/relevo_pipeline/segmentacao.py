"""Etapa 1 — Segmentação clássica (sem IA): separa o objeto do fundo.

Técnicas de processamento de imagem usadas:
- Filtro de mediana (tira ruído sem alargar bordas)
- Espaço de cor CIE Lab (a distância euclidiana ali se aproxima da diferença percebida pelo olho)
- Cor do fundo estimada pela mediana da borda da imagem (a borda é quase toda fundo)
- Distância de cor de cada pixel ao fundo + limiar adaptativo ao ruído da borda
  (acha tanto o tênis escuro quanto o solado branco em fundo cinza claro; só o brilho,
  como no Otsu, confundia o branco do solado com o fundo)
- Remoção do halo de sombra suave (mais escuro que o fundo, sem mudar a cor)
- Morfologia matemática: fechamento (fecha buracos pequenos) e abertura (remove ruído e a
  faixa fina de sombra de contato sob o solado)
- Maior componente conexa + preenchimento de buracos internos (flood fill)
- Avisos de qualidade (foto cortada, tênis pequeno/grande demais, objeto extra)
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


def _distancia_ao_fundo(img_bgr: np.ndarray) -> tuple[np.ndarray, float, np.ndarray]:
    """Distância de cada pixel à cor do fundo (Lab), o ruído típico do fundo e `lab - fundo`."""
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
    return dist, ruido, lab - fundo


def segmentar(
    img_bgr: np.ndarray, kernel: int = 5, limiar: float | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """Segmenta a foto. Retorna (máscara final bool, binária bruta uint8 antes de escolher a maior
    componente) — a bruta serve para `qualidade_mascara` contar objetos extras (sombra etc.).

    `limiar` é a distância mínima (em Lab) ao fundo para um pixel contar como objeto.
    Padrão: 4x o ruído do fundo, entre 10 e 30.
    """
    dist, ruido, diferenca = _distancia_ao_fundo(img_bgr)
    if limiar is None:
        limiar = float(np.clip(4.0 * ruido, 10.0, 30.0))
    objeto = dist > limiar
    halo = _halo_de_sombra(objeto, dist, diferenca, limiar)
    if _remocao_segura(objeto, halo):
        objeto &= ~halo
    binaria = (objeto * 255).astype(np.uint8)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel))
    binaria = cv2.morphologyEx(binaria, cv2.MORPH_CLOSE, k, iterations=2)
    # Abertura proporcional à imagem: remove ruído e a sombra de contato (faixa escura fina
    # sob o solado) sem comer o objeto, que é grande perto dela.
    lado = max(kernel, round(0.015 * min(binaria.shape)))
    k_grande = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (lado, lado))
    bruta = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, k_grande, iterations=1)

    final = _preencher_buracos(_maior_componente(bruta))
    return final > 0, bruta


def _halo_de_sombra(
    objeto: np.ndarray, dist: np.ndarray, diferenca: np.ndarray, limiar: float
) -> np.ndarray:
    """Pixels de SOMBRA suave colados no objeto, a remover.

    Em fundo muito limpo (foto de catálogo, ruído ~0) o limiar cai para o mínimo e o degradê da
    sombra em volta do tênis (até ~20 px) entra na máscara: a silhueta "incha" e a borda do modelo
    ganha cor de sombra (o bico branco do tenis-03).

    Critério da "meia altura" de uma borda desfocada: um pixel de halo é mais ESCURO que o fundo,
    SEM mudança de cor (a, b do Lab iguais) e está mais perto do fundo do que do objeto escuro ao
    lado dele (|ΔL| < metade do |ΔL| mais escuro num raio do tamanho do halo). Removemos os pixels
    de halo ligados ao lado de fora por outros pixels de halo — a casca, de fora para dentro.
    Um solado branco sombreado longe do cabedal preto não passa no teste e ainda BLOQUEIA a
    casca; um painel cinza (tenis-01) também fica.
    """
    dL = diferenca[..., 0]
    croma = np.linalg.norm(diferenca[..., 1:], axis=2)
    escuridao = np.clip(-dL, 0, None).astype(np.float32)
    raio = max(3, round(RAIO_HALO * max(objeto.shape)))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * raio + 1, 2 * raio + 1))
    vizinho_mais_escuro = cv2.dilate(escuridao, k)  # máximo local de |ΔL|
    contraste = float(np.percentile(escuridao[objeto], 95)) if objeto.any() else 0.0
    L = cv2.GaussianBlur(dL.astype(np.float32), (0, 0), 1.5)
    gradiente = (
        np.hypot(cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3))
        / 8
    )
    perto_do_fundo = cv2.distanceTransform(objeto.astype(np.uint8), cv2.DIST_L2, 3)
    halo = (
        objeto
        & (dL < 0)
        & (croma < CROMA_SOMBRA)
        & (escuridao < 0.5 * vizinho_mais_escuro)
        # Só em volta da parte MAIS escura do tênis (o halo é sombra dela). Sem isso, o solado
        # branco sombreado ao lado do solado vermelho (tenis-01) virava "halo" e sumia.
        & (vizinho_mais_escuro > max(3 * limiar, FRACAO_ESCURO * contraste))
        # Sombra é DEGRADÊ (a luminosidade muda de pixel para pixel); uma peça cinza é lisa
        & (gradiente > GRADIENTE_HALO)
        # ...e fica numa faixa colada no fundo de verdade, não no meio da silhueta
        & (perto_do_fundo <= raio)
    )
    # Cauda do degradê: quase da cor do fundo e lisa demais para o teste do gradiente; sem ela a
    # cauda vira uma "barreira" entre o fundo e o resto do halo (bico do tenis-03)
    cauda = (
        objeto
        & (dL < 0)
        & (croma < CROMA_SOMBRA)
        & (escuridao < 2 * limiar)
        & (perto_do_fundo <= raio)
    )
    halo |= cauda
    # Componentes de (halo ∪ fundo) que tocam o fundo: a casca, e não manchas internas
    n, rotulos = cv2.connectedComponents((halo | ~objeto).astype(np.uint8), connectivity=8)
    ids_fora = np.unique(rotulos[~objeto])
    return halo & np.isin(rotulos, ids_fora[ids_fora > 0])


def _remocao_segura(objeto: np.ndarray, halo: np.ndarray) -> bool:
    """Trava global: as regras locais do halo não separam 100 % sombra de peça clara e curva
    (o solado branco da foto frontal do tenis-01 parece sombra). Um halo de verdade é uma FAIXA
    FINA em volta do tênis: área removida ÷ perímetro = largura média da faixa, que não pode
    passar da largura máxima do degradê. E a remoção não pode partir o tênis em pedaços. Se
    falhar, desistimos e fica a máscara original."""
    if not halo.any() or not objeto.any():
        return False
    obj8 = objeto.astype(np.uint8)
    perimetro = int((obj8 - cv2.erode(obj8, np.ones((3, 3), np.uint8))).sum())
    largura_media = halo.sum() / max(1, perimetro)
    if largura_media > RAIO_HALO * max(objeto.shape):
        return False
    restante = (objeto & ~halo).astype(np.uint8)
    n, rotulos, stats, _ = cv2.connectedComponentsWithStats(restante, connectivity=8)
    maior = stats[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    return maior >= 0.97 * restante.sum()


def gerar_mascara(img_bgr: np.ndarray, kernel: int = 5, limiar: float | None = None) -> np.ndarray:
    """Retorna máscara booleana (True = objeto) de uma foto em fundo liso."""
    return segmentar(img_bgr, kernel=kernel, limiar=limiar)[0]


# Sombra suave (ver _halo_de_sombra)
RAIO_HALO = 0.025  # largura máxima do degradê de sombra: 2,5 % do maior lado da foto
CROMA_SOMBRA = 6.0  # sombra não muda a cor (a, b do Lab)
FRACAO_ESCURO = 0.6  # o halo só conta em volta do que tem >= 60 % do contraste máximo do tênis
GRADIENTE_HALO = 2.0  # variação mínima de luminosidade (Lab 8 bits) por pixel para ser degradê

# Limites dos avisos de qualidade (fração da área da foto / da maior componente)
AREA_MINIMA = 0.05
AREA_MAXIMA = 0.80
COMPONENTE_EXTRA = 0.15


def qualidade_mascara(
    mascara: np.ndarray, bruta: np.ndarray | None = None, vista: str = ""
) -> list[str]:
    """Avisos em linguagem simples sobre a máscara de uma foto (lista vazia = tudo certo)."""
    nome = f"da foto {vista}" if vista else "da foto"
    avisos = []
    if not mascara.any():
        return [f"Não encontramos o tênis {nome}. Use um fundo liso que contraste com o tênis."]

    borda = np.concatenate([mascara[0], mascara[-1], mascara[:, 0], mascara[:, -1]])
    if borda.any():
        avisos.append(
            f"O tênis encosta na borda {nome} e pode ter sido cortado. "
            "Afaste a câmera para que ele caiba inteiro, com uma folga em volta."
        )
    area = float(mascara.mean())
    if area < AREA_MINIMA:
        avisos.append(
            f"O tênis ocupa só {area:.0%} {nome}. Aproxime a câmera (ou use o zoom) "
            "para ele preencher boa parte do quadro."
        )
    elif area > AREA_MAXIMA:
        avisos.append(
            f"O tênis ocupa {area:.0%} {nome}, quase tudo. Afaste um pouco a câmera "
            "para sobrar fundo em volta."
        )
    if bruta is not None:
        n, _, stats, _ = cv2.connectedComponentsWithStats(bruta, connectivity=8)
        areas = np.sort(stats[1:, cv2.CC_STAT_AREA])[::-1] if n > 1 else np.array([])
        if len(areas) > 1 and areas[1] > COMPONENTE_EXTRA * areas[0]:
            avisos.append(
                f"Encontramos mais de um objeto grande {nome} (sombra forte ou algo no fundo?). "
                "Usamos o maior; se o modelo sair estranho, refaça a foto com o fundo limpo "
                "e luz difusa."
            )
    return avisos


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
