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
from scipy.spatial import cKDTree
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


# ---------- [5] Suavização de Taubin (F1-T02) ----------
ITERACOES_TAUBIN = 10
LAMBDA_TAUBIN = 0.5
NU_TAUBIN = 0.53


def suavizar(
    malha: trimesh.Trimesh, iteracoes: int = ITERACOES_TAUBIN
) -> tuple[trimesh.Trimesh, dict]:
    """Suavização de Taubin (filtro passa-baixas λ|μ sem encolhimento, F1-T02).

    Diferente da suavização Laplaciana simples — que puxa cada vértice para a média dos vizinhos
    repetidamente e faz o objeto encolher —, o filtro de Taubin alterna um passo de contração
    (+λ) com um passo de inflação (−μ, com μ > λ), atenuando altas frequências (ondulações da
    grade) enquanto preserva o volume e a escala real em cm.
    """
    if iteracoes <= 0 or len(malha.faces) == 0:
        return malha, {"usada": False, "iteracoes": 0}
    vol_antes = abs(float(malha.volume))
    angulos_antes = malha.face_adjacency_angles
    rug_antes = float(np.degrees(angulos_antes.std())) if len(angulos_antes) else 0.0

    suave = malha.copy()
    trimesh.smoothing.filter_taubin(
        suave, lamb=LAMBDA_TAUBIN, nu=NU_TAUBIN, iterations=iteracoes
    )
    suave.fix_normals()
    if not suave.is_watertight:
        return malha, {"usada": False, "iteracoes": iteracoes, "motivo": "abriria a malha"}
    suave.metadata.update(malha.metadata)

    vol_depois = abs(float(suave.volume))
    variacao_vol = 100.0 * abs(vol_depois - vol_antes) / max(vol_antes, 1e-6)
    angulos_depois = suave.face_adjacency_angles
    rug_depois = float(np.degrees(angulos_depois.std())) if len(angulos_depois) else 0.0
    if suave.extents[0] > 0:
        suave.vertices *= float(malha.extents[0]) / float(suave.extents[0])
        minimo, maximo = suave.bounds
        suave.apply_translation(
            [-(minimo[0] + maximo[0]) / 2, -minimo[1], -(minimo[2] + maximo[2]) / 2]
        )
    return suave, {
        "usada": True,
        "iteracoes": iteracoes,
        "variacao_volume_pct": round(variacao_vol, 2),
        "rugosidade_antes_graus": round(rug_antes, 2),
        "rugosidade_depois_graus": round(rug_depois, 2),
    }


# ---------- [6] Decimação por erro quádrico (F1-T03) ----------
AMOSTRAS_ERRO = 5000
VIZINHOS_ERRO = 12  # triângulos candidatos por ponto (pelo centro mais próximo)


def decimar(malha: trimesh.Trimesh, faces_alvo: int | None) -> tuple[trimesh.Trimesh, dict]:
    """Reduz a malha a ~`faces_alvo` triângulos (Garland–Heckbert, via fast-simplification).

    Cada vértice guarda uma quádrica Q (soma dos planos das faces vizinhas); o erro de mover o
    vértice para v é vᵀQv. O algoritmo colapsa sempre a aresta de menor erro até chegar ao alvo.
    Se o resultado não ficar fechado (alvo baixo demais), devolve a malha original: malha
    fechada é regra do projeto. Devolve (malha, métricas).
    """
    faces_antes = int(len(malha.faces))
    if faces_alvo is None or faces_antes <= faces_alvo:
        return malha, {"usada": False, "faces_antes": faces_antes}
    reduzida = malha.simplify_quadric_decimation(face_count=faces_alvo)
    reduzida.remove_unreferenced_vertices()
    reduzida.fix_normals()
    if not reduzida.is_watertight:
        return malha, {"usada": False, "faces_antes": faces_antes, "motivo": "abriria a malha"}
    # Mesmo sistema de coordenadas: a cor por vértice continua achando o voxel de cada vértice
    reduzida.metadata.update(malha.metadata)
    medio, maximo = erro_geometrico_cm(malha, reduzida)
    return reduzida, {
        "usada": True,
        "faces_antes": faces_antes,
        "erro_medio_mm": round(10 * medio, 3),
        "erro_max_mm": round(10 * maximo, 3),
    }


def erro_geometrico_cm(original: trimesh.Trimesh, reduzida: trimesh.Trimesh) -> tuple[float, float]:
    """Distância (média, máxima) de pontos da superfície original até a reduzida.

    Pontos amostrados na original; para cada um, os triângulos mais próximos da reduzida (pelo
    centro, com KD-tree) e a distância exata ponto–triângulo. Sem `rtree` (dependência a menos).
    """
    pontos, _ = trimesh.sample.sample_surface(original, AMOSTRAS_ERRO, seed=0)
    k = min(VIZINHOS_ERRO, len(reduzida.faces))
    _, idx = cKDTree(reduzida.triangles_center).query(pontos, k=k)
    repetidos = np.repeat(pontos, k, axis=0)
    mais_proximo = trimesh.triangles.closest_point(reduzida.triangles[idx.ravel()], repetidos)
    dist = np.linalg.norm(mais_proximo - repetidos, axis=1).reshape(-1, k).min(axis=1)
    return float(dist.mean()), float(dist.max())


# ---------- [7] Níveis de detalhe — LOD (F5-T02) ----------
FRACOES_LOD: tuple[float, ...] = (1.0, 0.25, 0.05)


def gerar_lods(
    malha: trimesh.Trimesh, fracoes: tuple[float, ...] = FRACOES_LOD
) -> list[dict]:
    """Gera 3 níveis de detalhe (100 %, 25 % e 5 % das faces, F5-T02) preservando a cor por vértice.

    Devolve `{"nivel": i, "fracao": f, "malha": m, "faces": int, "erro_medio_mm": float}`.
    """
    faces_base = int(len(malha.faces))
    tem_cor = malha.visual.kind == "vertex" and len(malha.visual.vertex_colors) == len(
        malha.vertices
    )
    arvore_cor = cKDTree(malha.vertices) if tem_cor else None
    cores_orig = np.asarray(malha.visual.vertex_colors) if tem_cor else None

    saida: list[dict] = []
    for i, fracao in enumerate(fracoes):
        if fracao >= 0.999 or faces_base == 0:
            saida.append(
                {
                    "nivel": i,
                    "fracao": float(fracao),
                    "malha": malha,
                    "faces": faces_base,
                    "erro_medio_mm": 0.0,
                }
            )
            continue
        alvo = max(24, int(round(faces_base * fracao)))
        m_lod, info = decimar(malha, faces_alvo=alvo)
        if arvore_cor is not None and cores_orig is not None and m_lod is not malha:
            _, idx_v = arvore_cor.query(m_lod.vertices, k=1)
            m_lod = m_lod.copy()
            m_lod.visual.vertex_colors = cores_orig[idx_v]
        saida.append(
            {
                "nivel": i,
                "fracao": float(fracao),
                "malha": m_lod,
                "faces": int(len(m_lod.faces)),
                "erro_medio_mm": float(info.get("erro_medio_mm", 0.0)),
            }
        )
    return saida

