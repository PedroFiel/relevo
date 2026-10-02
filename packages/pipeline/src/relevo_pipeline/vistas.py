"""Cadastro das vistas (fotos) que o pipeline entende.

Cada foto é uma projeção ORTOGRÁFICA ao longo de um eixo e enxerga dois dos três eixos. Vistas
opostas (lateral × outro lado, topo × sola, frente × trás) enxergam os MESMOS dois eixos, só
espelhados. Por isso toda vista é levada a um de três **quadros canônicos**:

    quadro   forma    linhas                         colunas
    lateral  (H, L)   y de cima para baixo           x: calcanhar -> bico
    topo     (W, L)   z (índice crescente)           x: calcanhar -> bico
    frente   (H, W)   y de cima para baixo           z (índice crescente)

e o espelhamento que leva a foto ao quadro é dado pela física da câmera (eixos destros:
x = comprimento, y = altura, z = x × y aponta para a câmera da lateral):

    lateral     câmera em +z: calcanhar à esquerda                          -> nada
    outro_lado  câmera em −z: o calcanhar aparece à DIREITA                 -> espelha colunas
    topo        câmera em +y, calcanhar à esquerda: z cresce para baixo      -> nada
    sola        câmera em −y, calcanhar à esquerda: z cresce para cima       -> espelha linhas
    frente      câmera em +x (olhando o bico): z cresce para a esquerda      -> espelha colunas
    tras        câmera em −x (olhando o calcanhar): z cresce para a direita  -> nada

`direcao` é a normal das faces que a câmera vê de frente (usada para pesar a cor).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Vista:
    nome: str
    quadro: str
    espelhar_colunas: bool
    espelhar_linhas: bool
    direcao: tuple[float, float, float]
    rotulo: str  # completa "a foto ..." nas mensagens ao usuário
    obrigatoria: bool = False


VISTAS: dict[str, Vista] = {
    v.nome: v
    for v in (
        Vista("lateral", "lateral", False, False, (0, 0, 1), "lateral", obrigatoria=True),
        Vista("outro_lado", "lateral", True, False, (0, 0, -1), "do outro lado"),
        Vista("topo", "topo", False, False, (0, 1, 0), "de cima", obrigatoria=True),
        Vista("sola", "topo", False, True, (0, -1, 0), "da sola"),
        Vista("frente", "frente", True, False, (1, 0, 0), "frontal"),
        Vista("tras", "frente", False, False, (-1, 0, 0), "traseira"),
    )
}

# Vista principal de cada quadro: as outras do mesmo quadro são registradas contra ela
PRINCIPAL = {"lateral": "lateral", "topo": "topo", "frente": "frente"}
# Espelhamento que o registro pode trocar em cada quadro: índice em (colunas, linhas)
EIXO_LIVRE = {"lateral": 0, "topo": 1, "frente": 0}


def validar_nomes(nomes) -> None:
    desconhecidas = sorted(set(nomes) - set(VISTAS))
    if desconhecidas:
        raise ValueError(
            f"Vista desconhecida: {', '.join(desconhecidas)}. Use: {', '.join(VISTAS)}."
        )
