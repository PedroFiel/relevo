"""Métricas de consistência entre as vistas (parte da F1-T07).

O visual hull é a INTERSEÇÃO dos prismas das 3 silhuetas. Se as fotos concordam, a sombra do
resultado em cada vista é igual à silhueta daquela vista (IoU = 1). Quando uma foto tem
perspectiva forte, outra escala ou outro ângulo, uma vista "come" a outra e o IoU cai.

- `iou_<vista>`: |sombra da forma final ∩ silhueta| / |sombra ∪ silhueta| na grade alinhada.
  (Versão em voxels; a F1-T07 completa rasteriza a malha final na resolução da foto.) Com a
  hipótese de seção (voxel.campo_secao) a forma deixa de ser o hull e o IoU passa a medir
  quanto ela ainda respeita cada foto.
- `razao_frente` / `razao_tras`: proporção altura/largura da foto frontal (ou traseira) dividida
  pela proporção que as fotos lateral e de topo implicam. 1,0 = concordam; longe de 1 = escala ou
  ângulo diferente (tipicamente perspectiva: câmera perto do tênis).
"""

from __future__ import annotations

import numpy as np

from relevo_pipeline.alinhamento import VistasAlinhadas, iou
from relevo_pipeline.vistas import VISTAS

LIMITE_RAZAO = 0.15  # divergência tolerada entre as proporções (15 %)
IOU_MINIMO = 0.90  # meta do projeto (CLAUDE.md, seção 3.3)


def projecao(ocupado: np.ndarray, quadro: str) -> np.ndarray:
    """Sombra da forma 3D (L, H, W) num quadro canônico (mesmo formato das máscaras)."""
    if quadro == "lateral":
        return ocupado.any(axis=2).T[::-1]  # (H, L) com o topo da foto em cima
    if quadro == "topo":
        return ocupado.any(axis=1).T  # (W, L)
    return ocupado.any(axis=0)[::-1]  # frente: (H, W)


def consistencia(vistas: VistasAlinhadas, ocupado: np.ndarray) -> dict:
    """IoU de cada silhueta com a sombra da forma FINAL e a razão de proporção das vistas
    frontal/traseira (linhas/colunas da caixa na foto ÷ H/W que a lateral e o topo implicam)."""
    _, H, W = vistas.dims
    out = {}
    for nome, m in vistas.mascaras.items():
        quadro = VISTAS[nome].quadro
        out[f"iou_{nome}"] = iou(projecao(ocupado, quadro), m)
        if quadro == "frente":
            y0, y1, x0, x1 = vistas.caixas[nome]
            out[f"razao_{nome}"] = (y1 - y0) / (x1 - x0) / (H / W)
    return {k: round(v, 3) for k, v in out.items()}


def avisos_consistencia(cons: dict) -> list[str]:
    avisos = []
    for nome in ("frente", "tras"):
        razao = cons.get(f"razao_{nome}")
        if razao is None or abs(razao - 1) <= LIMITE_RAZAO:
            continue
        forma = "mais alta" if razao > 1 else "mais larga"
        avisos.append(
            f"A foto {VISTAS[nome].rotulo} parece {forma} do que as outras indicam "
            f"({abs(razao - 1):.0%} de diferença): as fotos parecem ter escalas ou ângulos "
            "diferentes. Fotografe com a câmera afastada, na altura do tênis, usando o zoom."
        )
    piores = [
        k.removeprefix("iou_") for k, v in cons.items() if k.startswith("iou_") and v < IOU_MINIMO
    ]
    if piores:
        avisos.append(
            "As fotos não concordam bem entre si na vista " + ", ".join(piores) + ". "
            "Confira se todas mostram o tênis inteiro, no mesmo ângulo pedido no guia."
        )
    return avisos
