"""Etapa final — Exportação (.glb, .obj, .stl) e os intermediários do Raio-X."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import cv2
import numpy as np
import trimesh
from scipy.ndimage import binary_erosion

from relevo_pipeline.malha import PAD

if TYPE_CHECKING:
    from relevo_pipeline.pipeline import ResultadoPipeline

FORMATOS = {".glb", ".obj", ".stl"}


def exportar(malha: trimesh.Trimesh, caminho: str | Path) -> Path:
    caminho = Path(caminho)
    if caminho.suffix.lower() not in FORMATOS:
        raise ValueError(f"Formato não suportado: {caminho.suffix}. Use {sorted(FORMATOS)}")
    caminho.parent.mkdir(parents=True, exist_ok=True)
    malha.export(caminho)
    return caminho


# Vizinhança "face com face" (6 vizinhos) para a erosão
VIZINHOS_6 = np.zeros((3, 3, 3), bool)
VIZINHOS_6[1, 1, :] = VIZINHOS_6[1, :, 1] = VIZINHOS_6[:, 1, 1] = True


def voxels_de_superficie(ocupado: np.ndarray) -> np.ndarray:
    """Índices (N, 3) dos voxels ocupados com pelo menos um vizinho vazio (face com face).

    Só a "casca" aparece no Raio-X: os de dentro ficam escondidos e multiplicariam o arquivo.
    Casca = ocupado − erosão(ocupado), a morfologia matemática da segmentação, agora em 3D.
    """
    borda = np.pad(ocupado, 1)  # fora da grade conta como vazio
    miolo = binary_erosion(borda, structure=VIZINHOS_6)
    return np.argwhere(borda & ~miolo) - 1


def intermediarios(resultado: ResultadoPipeline) -> dict[str, bytes]:
    """Arquivos do Raio-X do pipeline (F1-T08 item 2, F5-T01), já em bytes para o Storage.

    - `mascara-<vista>.png`: a silhueta da segmentação (branco = tênis), no quadro processado;
    - `voxels.glb`: nuvem com o centro de cada voxel de superfície do visual hull, em cm, no mesmo
      sistema da malha final (o front desenha um cubo por ponto com *instancing*);
    - `malha-bruta.glb`: a malha logo depois do Marching Cubes, antes da decimação e da cor.
    """
    arquivos: dict[str, bytes] = {}
    for vista, m in resultado.mascaras.items():
        ok, png = cv2.imencode(".png", m.astype(np.uint8) * 255)
        if ok:
            arquivos[f"mascara-{vista}.png"] = png.tobytes()
    malha = resultado.malha_bruta or resultado.malha
    tv = float(malha.metadata["tamanho_voxel"])
    desl = np.asarray(malha.metadata["deslocamento"], dtype=np.float64)
    # Centro do voxel i em cm: o mesmo mapeamento da cor por vértice (cor.py), ao contrário
    centros = (voxels_de_superficie(resultado.voxels) + PAD) * tv + desl
    arquivos["voxels.glb"] = trimesh.PointCloud(centros.astype(np.float32)).export(file_type="glb")
    if resultado.malha_bruta is not None:
        bruta = resultado.malha_bruta.copy()
        bruta.visual = trimesh.visual.ColorVisuals(bruta)  # sem cor: a cor vem depois
        arquivos["malha-bruta.glb"] = bruta.export(file_type="glb")
    return arquivos
