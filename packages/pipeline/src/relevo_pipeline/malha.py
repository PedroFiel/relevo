"""Etapa 4 — Voxels -> malha poligonal com Marching Cubes.

O Marching Cubes percorre cada célula 2x2x2 da grade, classifica os 8 cantos como
dentro/fora (256 casos) e consulta uma tabela que diz quais triângulos gerar naquela célula.
A posição exata de cada vértice é interpolada linearmente na aresta onde o campo cruza o
nível (isosuperfície).

Antes do Marching Cubes aplicamos um leve desfoque gaussiano 3D no campo de ocupação para
evitar o aspecto de "escada" (voxels duros).
"""

from __future__ import annotations

import numpy as np
import trimesh
from scipy.ndimage import gaussian_filter
from skimage import measure

PAD = 2  # voxels vazios nas bordas da grade (garantem malha fechada)


def voxels_para_malha(
    ocupado: np.ndarray,
    comprimento_cm: float = 28.0,
    suavizacao_campo: float = 1.0,
) -> trimesh.Trimesh:
    """Converte a grade de voxels numa malha triangular em escala real (centímetros)."""
    if not ocupado.any():
        raise ValueError("Nenhum voxel ocupado: as silhuetas não se intersectam.")

    campo = np.pad(ocupado.astype(np.float32), PAD)  # borda vazia garante malha fechada
    if suavizacao_campo > 0:
        campo = gaussian_filter(campo, sigma=suavizacao_campo)

    tamanho_voxel = comprimento_cm / ocupado.shape[0]
    verts, faces, _, _ = measure.marching_cubes(campo, level=0.5, spacing=(tamanho_voxel,) * 3)

    # As normais são recalculadas pelo trimesh a partir da orientação (winding) das faces,
    # depois de fix_normals() garantir que todas apontam para FORA do objeto.
    malha = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    # Centraliza no chão: x/z centrados na origem, y mínimo = 0
    minimo, maximo = malha.bounds
    deslocamento = [-(minimo[0] + maximo[0]) / 2, -minimo[1], -(minimo[2] + maximo[2]) / 2]
    malha.apply_translation(deslocamento)
    malha.fix_normals()
    # Guardados para a cor por vértice conseguir voltar de cm para índice de voxel
    malha.metadata["tamanho_voxel"] = float(tamanho_voxel)
    malha.metadata["deslocamento"] = [float(d) for d in deslocamento]
    return malha
