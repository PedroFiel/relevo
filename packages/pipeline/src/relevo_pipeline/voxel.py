"""Etapa 3 — Visual Hull por escultura de voxels (Shape from Silhouette).

Ideia: um bloco de L x H x W voxels; cada vista "corta" o que fica fora da silhueta.
Projeção ortográfica = basta descartar o eixo que a câmera não vê.

    ocupado[x, y, z] = lateral[y, x]  AND  topo[z, x]  AND  frente[y, z]

As linhas das imagens crescem para baixo, então invertemos o eixo y para que y=0 seja o chão.
"""

from __future__ import annotations

import numpy as np

from relevo_pipeline.alinhamento import VistasAlinhadas


def esculpir(vistas: VistasAlinhadas) -> np.ndarray:
    """Retorna grade booleana (L, H, W) com os voxels que sobreviveram às 3 vistas."""
    lat = vistas.lateral[::-1, :]  # (H, L) com y para cima
    top = vistas.topo  # (W, L)

    # Broadcasting: cada vista vira um "prisma" estendido no eixo que ela não enxerga.
    ocupado = lat.T[:, :, None] & top.T[:, None, :]  # (L, H, 1) & (L, 1, W) -> (L, H, W)
    if vistas.frente is not None:
        fre = vistas.frente[::-1, :]  # (H, W) com y para cima
        ocupado = ocupado & fre[None, :, :]
    return ocupado


def contar_voxels(ocupado: np.ndarray) -> dict[str, int]:
    return {"total": int(ocupado.size), "ocupados": int(ocupado.sum())}
