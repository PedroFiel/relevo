"""Orquestra as etapas do pipeline e guarda os resultados intermediários.

Os intermediários (máscaras, voxels) são devolvidos para permitir o modo "Raio-X do pipeline"
no front-end e para depuração.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
import trimesh

from relevo_pipeline.alinhamento import VistasAlinhadas, alinhar_vistas
from relevo_pipeline.malha import voxels_para_malha
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.voxel import esculpir


@dataclass
class ResultadoPipeline:
    malha: trimesh.Trimesh
    mascaras: dict[str, np.ndarray]
    vistas: VistasAlinhadas
    voxels: np.ndarray
    tempos_s: dict[str, float] = field(default_factory=dict)

    @property
    def metricas(self) -> dict:
        return {
            "dims_voxels": list(self.vistas.dims),
            "voxels_ocupados": int(self.voxels.sum()),
            "vertices": int(len(self.malha.vertices)),
            "faces": int(len(self.malha.faces)),
            "fechada": bool(self.malha.is_watertight),
            "dimensoes_cm": [round(float(v), 2) for v in self.malha.extents],
            "tempos_s": {k: round(v, 3) for k, v in self.tempos_s.items()},
        }


def processar(
    lateral_bgr: np.ndarray,
    topo_bgr: np.ndarray,
    frente_bgr: np.ndarray | None = None,
    comprimento_cm: float = 28.0,
    resolucao: int = 128,
) -> ResultadoPipeline:
    tempos: dict[str, float] = {}

    t = time.perf_counter()
    mascaras = {"lateral": gerar_mascara(lateral_bgr), "topo": gerar_mascara(topo_bgr)}
    if frente_bgr is not None:
        mascaras["frente"] = gerar_mascara(frente_bgr)
    tempos["segmentacao"] = time.perf_counter() - t

    t = time.perf_counter()
    vistas = alinhar_vistas(
        mascaras["lateral"], mascaras["topo"], mascaras.get("frente"), resolucao=resolucao
    )
    tempos["alinhamento"] = time.perf_counter() - t

    t = time.perf_counter()
    voxels = esculpir(vistas)
    tempos["visual_hull"] = time.perf_counter() - t

    t = time.perf_counter()
    malha = voxels_para_malha(voxels, comprimento_cm=comprimento_cm)
    tempos["marching_cubes"] = time.perf_counter() - t

    return ResultadoPipeline(
        malha=malha, mascaras=mascaras, vistas=vistas, voxels=voxels, tempos_s=tempos
    )
