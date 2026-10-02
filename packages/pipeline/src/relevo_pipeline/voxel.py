"""Etapa 3 — Visual Hull por escultura de voxels (Shape from Silhouette).

Ideia: um bloco de L x H x W voxels; cada vista "corta" o que fica fora da silhueta.
Projeção ortográfica = basta descartar o eixo que a câmera não vê.

    ocupado[x, y, z] = lateral[y, x]  AND  topo[z, x]  AND  frente[y, z]  (AND as vistas extras)

Vistas opostas (outro lado, sola, trás) entram no MESMO quadro da principal (ver vistas.py) e
somam mais uma restrição ao mesmo par de eixos: com fotos reais (perspectiva, outro pé), cada
uma corta um pouco do que a outra deixou passar.

As linhas das imagens crescem para baixo, então invertemos o eixo y para que y=0 seja o chão.

Versão contínua (usada para gerar a malha): em vez de 0/1, cada vista dá a distância assinada
d(ponto) até a borda da sua silhueta (negativa dentro). A interseção de sólidos implícitos
(CSG) é o MÁXIMO das distâncias:

    campo[x, y, z] = max(d_lateral(y, x), d_topo(z, x), d_frente(y, z))

    campo < 0  <=>  dentro das 3 silhuetas  <=>  voxel ocupado no hull binário

O Marching Cubes no nível 0 desse campo interpola a borda entre os voxels, então a superfície
segue a silhueta com precisão de fração de voxel — sem os degraus do campo 0/1.
"""

from __future__ import annotations

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d, map_coordinates

from relevo_pipeline.alinhamento import VistasAlinhadas, distancia_assinada
from relevo_pipeline.vistas import VISTAS


def _prisma(m: np.ndarray, quadro: str) -> np.ndarray:
    """Estende uma imagem do quadro canônico no eixo que ela não vê -> (L|1, H|1, W|1)."""
    if quadro == "lateral":  # (H, L), y de cima para baixo
        return m[::-1, :].T[:, :, None]
    if quadro == "topo":  # (W, L)
        return m.T[:, None, :]
    return m[::-1, :][None, :, :]  # frente: (H, W)


def esculpir(vistas: VistasAlinhadas) -> np.ndarray:
    """Grade booleana (L, H, W) com os voxels que sobreviveram a todas as vistas."""
    L, H, W = vistas.dims
    ocupado = np.ones((L, H, W), bool)
    # Broadcasting: cada vista vira um "prisma" estendido no eixo que ela não enxerga.
    for nome, m in vistas.mascaras.items():
        ocupado &= _prisma(m, VISTAS[nome].quadro)
    return ocupado


def contar_voxels(ocupado: np.ndarray) -> dict[str, int]:
    return {"total": int(ocupado.size), "ocupados": int(ocupado.sum())}


def campo_implicito(vistas: VistasAlinhadas) -> np.ndarray:
    """Campo (L, H, W) float32: distância assinada (em voxels) do visual hull; < 0 = dentro."""
    L, H, W = vistas.dims
    campo = np.full((L, H, W), -np.inf, np.float32)
    for nome, c in vistas.campos.items():
        campo = np.maximum(campo, _prisma(c, VISTAS[nome].quadro))
    return campo


# Perfil comum: ponto entra se estiver dentro do hull em >= 90 % das fatias centrais (robusto a
# fatias ruidosas); as pontas (10 % de cada lado) ficam de fora porque são minúsculas.
QUANTIL_PERFIL = 0.9
MARGEM_PONTAS = 0.1
AMOSTRAS_PERFIL = 64
SUAVIZACAO_CAIXAS = 1.5  # desvio (em fatias) do filtro gaussiano nas caixas das fatias
SUAVIZACAO_PERFIL = 2.5  # desvio (em linhas de 64) do filtro nas bordas do perfil


def campo_secao(campo_hull: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Hipótese de seção transversal comum (cilindro generalizado) sobre o visual hull.

    Retorna (campo da seção em voxels, perfil booleano AMOSTRAS × AMOSTRAS — linha 0 = chão).

    Com vistas só nos 3 eixos, cada fatia x = constante do hull é "retangular" onde a foto
    frontal não aperta (bico quadrado). Supomos que todas as fatias têm o MESMO perfil T,
    escalado para a altura e a largura da fatia (varredura de um perfil 2D ao longo de x — o
    cilindro generalizado da modelagem geométrica). Se isso vale, cada fatia do hull, normalizada
    para a sua caixa, CONTÉM T; logo a melhor estimativa é a interseção das fatias normalizadas
    (aqui, robusta: >= 90 % delas). Depois cada fatia vira T escalado.

    Entra por `max` com o hull: só remove volume e nunca passa das silhuetas. No sintético (forma
    real conhecida) o IoU 3D sobe de 0,92 para 0,98. Sem foto frontal/traseira as fatias do hull
    são retângulos, T sai retângulo e nada muda.
    """
    L, H, W = campo_hull.shape
    n = AMOSTRAS_PERFIL
    # Caixa CONTÍNUA de cada fatia (altura e0..e1 em y, largura em z), tirada da sombra do campo
    # na lateral e no topo. Caixas inteiras (em voxels) faziam a escala do perfil "pular" de uma
    # fatia para a outra e a malha ficava com ondas ao longo do comprimento.
    y0, y1 = _bordas(campo_hull.min(axis=2))  # (L,) cada
    z0, z1 = _bordas(campo_hull.min(axis=1))
    tem = np.isfinite(y0) & np.isfinite(z0)
    y0, y1, z0, z1 = (np.where(tem, a, 0.0) for a in (y0, y1, z0, z1))
    # Suaviza as caixas ao longo do comprimento: oscilações de fração de voxel viravam ondas nas
    # normais (e listras na cor). Só nas fatias com objeto, para não puxar as pontas para zero.
    if tem.sum() > 3:
        dentro = np.nonzero(tem)[0]
        for a in (y0, y1, z0, z1):
            a[dentro] = gaussian_filter1d(a[dentro], SUAVIZACAO_CAIXAS, mode="nearest")
    alt = np.where(tem, y1 - y0, 1.0).astype(np.float32)
    larg = np.where(tem, z1 - z0, 1.0).astype(np.float32)

    # 1) Amostra cada fatia central do hull numa grade normalizada n × n (v = altura, u = largura)
    t = (np.arange(n) + 0.5) / n
    V, U = np.meshgrid(t, t, indexing="ij")
    xs = np.nonzero(tem)[0]
    xs = xs[int(MARGEM_PONTAS * len(xs)) : int((1 - MARGEM_PONTAS) * len(xs))]
    X = np.broadcast_to(xs[:, None, None], (len(xs), n, n))
    Y = y0[xs, None, None] + V[None] * alt[xs, None, None]
    Z = z0[xs, None, None] + U[None] * larg[xs, None, None]
    fatias = map_coordinates(campo_hull, [X.ravel(), Y.ravel(), Z.ravel()], order=1, mode="nearest")
    fracao = (fatias.reshape(len(xs), n, n) < 0).mean(axis=0).astype(np.float32)
    m = 8 * n
    perfil = perfil_suave(fracao >= QUANTIL_PERFIL, m)

    # 2) Cada fatia vira o perfil escalado: amostra a SDF do perfil nas coordenadas normalizadas
    sdf = distancia_assinada(perfil) / m  # em frações do perfil
    v = (np.arange(H)[None, :, None] - y0[:, None, None]) / alt[:, None, None]
    u = (np.arange(W)[None, None, :] - z0[:, None, None]) / larg[:, None, None]
    v, u = np.broadcast_arrays(v, u)
    d = map_coordinates(sdf, [v * m - 0.5, u * m - 0.5], order=1, mode="nearest")
    d = d.reshape(L, H, W) * np.sqrt(alt * larg)[:, None, None]  # frações -> voxels
    d[~tem] = np.inf  # fatia vazia: o hull já está fora
    return d.astype(np.float32), perfil


def perfil_suave(perfil: np.ndarray, m: int) -> np.ndarray:
    """Perfil binário n × n (linha 0 = chão) -> perfil m × m com borda SUAVE.

    Cada degrau da borda do perfil vira, depois de escalado em todas as fatias, uma "curva de
    nível" ao longo do tênis inteiro (ondas horizontais). Então descrevemos o perfil como duas
    funções da altura — borda esquerda uE(v) e direita uD(v) —, suavizamos as duas com um filtro
    gaussiano em v e redesenhamos o polígono em alta resolução.
    """
    n = perfil.shape[0]
    linhas = np.nonzero(perfil.any(axis=1))[0]
    if len(linhas) < 3:
        return cv2.resize(perfil.astype(np.uint8), (m, m), interpolation=cv2.INTER_NEAREST) > 0
    sub = perfil[linhas]
    esq = sub.argmax(axis=1).astype(np.float64)  # primeira coluna dentro
    dir_ = (n - sub[:, ::-1].argmax(axis=1)).astype(np.float64)  # uma depois da última
    esq = gaussian_filter1d(esq, SUAVIZACAO_PERFIL, mode="nearest")
    dir_ = gaussian_filter1d(dir_, SUAVIZACAO_PERFIL, mode="nearest")
    v = linhas + 0.5
    v[0], v[-1] = linhas[0], linhas[-1] + 1  # fecha no chão e no topo do perfil
    k = m / n
    poligono = np.concatenate([np.stack([esq, v], 1), np.stack([dir_, v], 1)[::-1]]) * k
    saida = np.zeros((m, m), np.uint8)
    cv2.fillPoly(saida, [np.round(poligono * 16).astype(np.int32)], 1, cv2.LINE_8, shift=4)
    return saida > 0


def _bordas(f: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Para cada linha de `f` (L, N) — um campo com < 0 dentro —, as posições contínuas (em
    índice de voxel) onde ele cruza zero na entrada e na saída, por interpolação linear entre os
    dois voxels vizinhos. Linha toda fora -> inf."""
    L, N = f.shape
    dentro = f < 0
    tem = dentro.any(axis=1)
    i0 = dentro.argmax(axis=1)
    i1 = N - 1 - dentro[:, ::-1].argmax(axis=1)
    linhas = np.arange(L)

    def cruzamento(i_fora, i_dentro, borda):
        fora_ok = (i_fora >= 0) & (i_fora < N)
        a = f[linhas, np.clip(i_fora, 0, N - 1)]
        b = f[linhas, i_dentro]
        t = a / np.where(a - b == 0, 1, a - b)  # fração do caminho de i_fora até i_dentro
        return np.where(fora_ok, i_fora + t * (i_dentro - i_fora), borda)

    e0 = cruzamento(i0 - 1, i0, -0.5)
    e1 = cruzamento(i1 + 1, i1, N - 0.5)
    return np.where(tem, e0, np.inf), np.where(tem, e1, np.inf)
