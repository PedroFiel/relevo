"""Etapa 1b — Orientação automática das fotos lateral e de topo.

O visual hull exige a convenção de eixos (calcanhar à esquerda, bico à direita). Se o usuário
fotografa o topo "em pé" (calcanhar em cima) o pipeline troca comprimento por largura e gera um
tênis de 80 cm de largura. Em vez de recusar a foto, corrigimos usando a anatomia do calçado
(só geometria da silhueta, sem IA):

- **Topo:** o comprimento é o maior lado; se a silhueta está em pé, giramos 90°. A parte mais
  larga (antepé, onde ficam os dedos) fica a ~2/3 do comprimento, do lado do bico; se ela está à
  esquerda, giramos 180°. Só usamos ROTAÇÕES: girar uma foto feita de cima equivale a girar a
  câmera, então a foto continua fisicamente correta (um espelhamento não continuaria).
- **Lateral:** a metade do calcanhar (cano/colarinho) tem mais área que a do bico (biqueira
  baixa); se a área maior está à direita, espelhamos na horizontal. Espelhar a lateral equivale a
  fotografar o outro lado, que o pipeline já assume igual (espelhado).

Quando o sinal é fraco (silhueta quase simétrica) não mexemos e avisamos.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.ndimage import uniform_filter1d

from relevo_pipeline.ajuste import matriz_rotacao_inversa
from relevo_pipeline.alinhamento import recortar

# Razão de área (metade do calcanhar / metade do bico) na lateral. Medido: 1,5–2,4 nos tênis.
RAZAO_LATERAL_CONFIANTE = 1.15
# Posição do antepé (0 = calcanhar, 1 = bico) no topo. Medido: ~0,67 nos tênis reais.
MARGEM_TOPO = 0.05
FRACAO_LARGURA_MAXIMA = 0.97


@dataclass
class Orientacao:
    """Correção aplicada a uma foto: girar `rotacao_90` vezes 90° (anti-horário) e/ou espelhar."""

    rotacao_90: int = 0
    espelhada: bool = False
    confiante: bool = True

    @property
    def alterada(self) -> bool:
        return self.rotacao_90 % 4 != 0 or self.espelhada

    def aplicar(self, img: np.ndarray) -> np.ndarray:
        """Aplica a mesma correção a uma máscara (H, W) ou a uma foto (H, W, 3)."""
        if self.rotacao_90 % 4:
            img = np.rot90(img, self.rotacao_90)
        if self.espelhada:
            img = img[:, ::-1]
        return np.ascontiguousarray(img)

    @property
    def graus_horario(self) -> int:
        """Rotação aplicada, no sentido HORÁRIO (mesma convenção do ajuste do usuário)."""
        return (-90 * self.rotacao_90) % 360

    def matriz(self, largura: int, altura: int) -> np.ndarray:
        """3×3 que leva um ponto da foto ORIENTADA de volta à foto antes da orientação.

        `aplicar` gira `rotacao_90` vezes no sentido anti-horário e depois espelha; aqui
        desfazemos na ordem inversa (a matriz da direita é aplicada primeiro).
        """
        M = matriz_rotacao_inversa(self.graus_horario, largura, altura)
        if self.espelhada:
            largura_girada = altura if self.rotacao_90 % 2 else largura
            M = M @ np.array([[-1, 0, largura_girada], [0, 1, 0], [0, 0, 1]], np.float64)
        return M

    def descrever(self) -> dict:
        return {
            "rotacao_graus": self.graus_horario,
            "espelhada": self.espelhada,
            "confiante": self.confiante,
        }


def posicao_antepe(mascara: np.ndarray) -> float:
    """Posição (0..1, da esquerda) da região mais larga da silhueta de topo."""
    m = recortar(mascara)
    largura = uniform_filter1d(m.sum(axis=0).astype(np.float64), max(3, m.shape[1] // 20))
    # Centro da faixa quase máxima (e não o argmax): numa forma simétrica dá 0,5, não um extremo.
    cols = np.nonzero(largura >= FRACAO_LARGURA_MAXIMA * largura.max())[0]
    return float(cols.mean() / max(1, m.shape[1] - 1))


def razao_calcanhar(mascara: np.ndarray) -> float:
    """Área da metade esquerda / área da metade direita da silhueta lateral."""
    m = recortar(mascara)
    meio = m.shape[1] // 2
    return float(m[:, :meio].sum() / max(1, m[:, meio:].sum()))


def orientar_topo(mascara: np.ndarray) -> Orientacao:
    """Rotação que deixa o topo deitado, com calcanhar à esquerda e bico à direita."""
    linhas, colunas = recortar(mascara).shape
    # Em pé -> gira 90° anti-horário (o alto da foto vai para a esquerda)
    k = 1 if linhas > colunas else 0
    pos = posicao_antepe(np.rot90(mascara, k))
    if pos < 0.5 - MARGEM_TOPO:  # antepé à esquerda -> bico está à esquerda: gira mais 180°
        return Orientacao(rotacao_90=k + 2)
    return Orientacao(rotacao_90=k, confiante=pos > 0.5 + MARGEM_TOPO)


def orientar_lateral(mascara: np.ndarray) -> Orientacao:
    """Espelhamento que deixa o calcanhar à esquerda na foto lateral."""
    razao = razao_calcanhar(mascara)
    if razao < 1 / RAZAO_LATERAL_CONFIANTE:
        return Orientacao(espelhada=True)
    return Orientacao(confiante=razao > RAZAO_LATERAL_CONFIANTE)
