"""Etapa 4 — Voxels -> malha poligonal com Marching Cubes.

O Marching Cubes percorre cada célula 2x2x2 da grade, classifica os 8 cantos como
dentro/fora (256 casos) e consulta uma tabela que diz quais triângulos gerar naquela célula.
A posição exata de cada vértice é interpolada linearmente na aresta onde o campo cruza o
nível (isosuperfície).

Duas entradas possíveis:
- `campo_para_malha`: campo de distância assinada do visual hull (voxel.campo_implicito),
  nível 0. É o caminho do pipeline: a borda já vem com precisão de fração de voxel.
- `voxels_para_malha`: grade 0/1 (escultura binária), nível 0,5 após um desfoque gaussiano 3D.
  Mais simples de explicar, mas deixa "degraus" de um voxel visíveis na superfície.
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
    return _malha_do_campo(campo, 0.5, comprimento_cm)


def campo_para_malha(campo: np.ndarray, comprimento_cm: float = 28.0) -> trimesh.Trimesh:
    """Converte o campo de distância assinada (< 0 = dentro, em voxels) em malha em centímetros."""
    if not (campo < 0).any():
        raise ValueError("Nenhum voxel ocupado: as silhuetas não se intersectam.")
    # Valor EXATAMENTE no nível faz o Marching Cubes criar triângulos degenerados (vértices
    # repetidos) e a malha deixa de ser fechada. Acontece quando a borda cai bem no meio de dois
    # pixels (+1 e -1 -> 0). Empurrar esses pontos para "fora" por um epsilon resolve.
    campo = np.where(campo == 0, np.float32(1e-4), campo)
    # Borda "fora" (distância positiva) garante malha fechada mesmo onde o objeto toca a grade
    campo = np.pad(campo, PAD, constant_values=float(PAD))
    return _malha_do_campo(-campo, 0.0, comprimento_cm)


def _malha_do_campo(campo: np.ndarray, nivel: float, comprimento_cm: float) -> trimesh.Trimesh:
    """Marching Cubes (campo maior que `nivel` = dentro) + escala real + centraliza no chão."""
    verts, faces, _, _ = measure.marching_cubes(campo, level=nivel)  # em unidades de voxel
    # Escala real: o comprimento MEDIDO da malha (eixo x) vira exatamente o informado pelo
    # usuário. (A borda cai numa fração de voxel que depende do campo; não dá para assumir L.)
    tamanho_voxel = comprimento_cm / float(np.ptp(verts[:, 0]))
    verts = verts * tamanho_voxel

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
