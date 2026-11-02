"""Mapeamento UV em 6 ilhas ortográficas e *texture baking* com dilatação de costuras (F4-T06).

Em vez de depender exclusivamente de costuras arbitrárias, classificamos cada triângulo pela
direção dominante da sua normal (`+Z`, `−Z`, `+Y`, `−Y`, `+X`, `−X` — as mesmas 6 vistas do
calçado) e empacotamos as 6 ilhas numa grade 3×2 dentro do espaço de textura [0, 1]².

Propriedades garantidas:
1. Toda coordenada (u, v) ∈ [0, 1]², separada por margem entre as ilhas.
2. Como todo triângulo é projetado perpendicularmente ao maior componente da sua normal
   (|n_k| ≥ 1/√3), nenhum triângulo 3D válido colapsa para área UV zero.
3. No *baking* da imagem de textura (`tamanho × tamanho`), as bordas das ilhas são dilatadas por
   vizinho mais próximo (transformada de distância) para eliminar costuras escuras na interpolação
   bilinear da GPU.
"""

from __future__ import annotations

import cv2
import numpy as np
import trimesh
from PIL import Image
from scipy.ndimage import distance_transform_edt
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

from relevo_pipeline.alinhamento import VistasAlinhadas
from relevo_pipeline.cor import colorir_malha

# Cada ilha: (eixo_dominante, sinal, eixo_u, eixo_v, coluna_grade, linha_grade)
ILHAS_UV: tuple[tuple[int, int, int, int, int, int], ...] = (
    (2, 1, 0, 1, 0, 0),   # +Z (lateral): u=x, v=y
    (2, -1, 0, 1, 1, 0),  # -Z (outro lado): u=x, v=y
    (1, 1, 0, 2, 2, 0),   # +Y (topo): u=x, v=z
    (1, -1, 0, 2, 0, 1),  # -Y (sola): u=x, v=z
    (0, 1, 2, 1, 1, 1),   # +X (frente): u=z, v=y
    (0, -1, 2, 1, 2, 1),  # -X (trás): u=z, v=y
)


def desdobrar_uv(
    malha: trimesh.Trimesh, margem: float = 0.04
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Desdobra a malha em 6 ilhas ortográficas no atlas [0, 1]².

    Devolve `(vmapping, faces_uv, uvs)`:
    - `vmapping`: `(3*F,)` índice do vértice original para cada vértice UV desdobrado;
    - `faces_uv`: `(F, 3)` triângulos indexando `uvs`;
    - `uvs`: `(3*F, 2)` coordenadas (u, v) ∈ [0, 1]².
    """
    n_faces = len(malha.faces)
    if n_faces == 0:
        return (
            np.empty(0, dtype=np.int64),
            np.empty((0, 3), dtype=np.int64),
            np.empty((0, 2), dtype=np.float64),
        )

    verts = np.asarray(malha.vertices, dtype=np.float64)
    faces = np.asarray(malha.faces, dtype=np.int64)
    normais = np.asarray(malha.face_normals, dtype=np.float64)

    eixo_dom = np.argmax(np.abs(normais), axis=1)
    sinal_dom = np.where(normais[np.arange(n_faces), eixo_dom] >= 0, 1, -1)

    min_v = verts.min(axis=0)
    span_v = np.maximum(verts.max(axis=0) - min_v, 1e-6)
    verts_norm = (verts - min_v) / span_v  # em [0, 1]^3

    vmapping = faces.reshape(-1)
    faces_uv = np.arange(3 * n_faces, dtype=np.int64).reshape(n_faces, 3)
    uvs_faces = np.zeros((n_faces, 3, 2), dtype=np.float64)

    larg_celula = 1.0 / 3.0
    alt_celula = 1.0 / 2.0
    escala_u = larg_celula * (1.0 - 2.0 * margem)
    escala_v = alt_celula * (1.0 - 2.0 * margem)

    for eixo, sinal, eu, ev, col, lin in ILHAS_UV:
        mascara = (eixo_dom == eixo) & (sinal_dom == sinal)
        if not mascara.any():
            continue
        f_idx = faces[mascara]
        u_local = verts_norm[f_idx, eu]
        v_local = verts_norm[f_idx, ev]
        if sinal < 0:
            u_local = 1.0 - u_local
        u0 = col * larg_celula + larg_celula * margem
        v0 = lin * alt_celula + alt_celula * margem
        uvs_faces[mascara, :, 0] = u0 + u_local * escala_u
        uvs_faces[mascara, :, 1] = v0 + v_local * escala_v

    uvs = np.clip(uvs_faces.reshape(-1, 2), 0.0, 1.0)
    return vmapping, faces_uv, uvs


def areas_uv(faces_uv: np.ndarray, uvs: np.ndarray) -> np.ndarray:
    """Área 2D de cada triângulo no espaço UV."""
    if len(faces_uv) == 0:
        return np.empty(0, dtype=np.float64)
    tris = uvs[faces_uv]
    ab = tris[:, 1] - tris[:, 0]
    ac = tris[:, 2] - tris[:, 0]
    return 0.5 * np.abs(ab[:, 0] * ac[:, 1] - ab[:, 1] * ac[:, 0])


def assar_textura(
    malha: trimesh.Trimesh,
    fotos_bgr: dict[str, np.ndarray] | None = None,
    vistas: VistasAlinhadas | None = None,
    *,
    tamanho: int = 512,
    dilatacao_px: int = 4,
) -> tuple[trimesh.Trimesh, np.ndarray, dict]:
    """Gera o atlas UV, rasteriza a textura RGB e dilata as bordas das ilhas (F4-T06)."""
    if fotos_bgr is not None and vistas is not None and malha.visual.kind != "vertex":
        malha = malha.copy()
        colorir_malha(malha, vistas, vistas.mascaras, fotos_bgr)

    if malha.visual.kind == "vertex" and len(malha.visual.vertex_colors) == len(malha.vertices):
        cores_vert = np.asarray(malha.visual.vertex_colors[:, :3], dtype=np.uint8)
    else:
        cores_vert = np.full((len(malha.vertices), 3), 180, dtype=np.uint8)

    vmapping, faces_uv, uvs = desdobrar_uv(malha)
    verts_uv = malha.vertices[vmapping]
    cores_uv = cores_vert[vmapping]

    textura = np.zeros((tamanho, tamanho, 3), dtype=np.uint8)
    mascara_ilhas = np.zeros((tamanho, tamanho), dtype=np.uint8)

    # Coordenadas de pixel na textura (v cresce para cima em UV, linha 0 no topo da imagem)
    px = np.clip(np.round(uvs[:, 0] * (tamanho - 1)).astype(np.int32), 0, tamanho - 1)
    py = np.clip(np.round((1.0 - uvs[:, 1]) * (tamanho - 1)).astype(np.int32), 0, tamanho - 1)
    pts_2d = np.column_stack([px, py])

    cores_face = cores_uv.reshape(-1, 3, 3).mean(axis=1).round().astype(np.uint8)
    tris_2d = pts_2d.reshape(-1, 3, 2)

    for tri, cor in zip(tris_2d, cores_face, strict=False):
        cor_tupla = (int(cor[0]), int(cor[1]), int(cor[2]))
        cv2.fillConvexPoly(textura, tri, cor_tupla)
        cv2.fillConvexPoly(mascara_ilhas, tri, 255)

    # Dilatação de costuras (2–4 px) e preenchimento por vizinho mais próximo fora das ilhas
    if mascara_ilhas.any():
        _, indices_prox = distance_transform_edt(mascara_ilhas == 0, return_indices=True)
        if dilatacao_px > 0:
            kernel = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (2 * dilatacao_px + 1, 2 * dilatacao_px + 1)
            )
            mascara_dilatada = cv2.dilate(mascara_ilhas, kernel)
        else:
            mascara_dilatada = mascara_ilhas
        borda = (mascara_dilatada > 0) & (mascara_ilhas == 0)
        textura[borda] = textura[indices_prox[0][borda], indices_prox[1][borda]]
        # Fundo neutro fora da área dilatada (evita preto puro se algum pixel escapar)
        fora = mascara_dilatada == 0
        textura[fora] = (128, 128, 128)
    else:
        textura[:] = (128, 128, 128)

    img_pil = Image.fromarray(textura, mode="RGB")
    material = PBRMaterial(baseColorTexture=img_pil, roughnessFactor=0.8, metallicFactor=0.05)
    malha_uv = trimesh.Trimesh(
        vertices=verts_uv,
        faces=faces_uv,
        visual=TextureVisuals(uv=uvs, material=material),
        process=False,
    )
    malha_uv.metadata.update(malha.metadata)

    areas = areas_uv(faces_uv, uvs)
    metricas = {
        "ilhas": len(ILHAS_UV),
        "tamanho_px": int(tamanho),
        "cobertura_pct": round(float((mascara_ilhas > 0).mean() * 100.0), 2),
        "faces_area_zero": int((areas <= 1e-12).sum()),
    }
    return malha_uv, textura, metricas
