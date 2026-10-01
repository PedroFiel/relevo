"""Etapa final — Exportação nos formatos suportados (.glb, .obj, .stl)."""

from __future__ import annotations

from pathlib import Path

import trimesh

FORMATOS = {".glb", ".obj", ".stl"}


def exportar(malha: trimesh.Trimesh, caminho: str | Path) -> Path:
    caminho = Path(caminho)
    if caminho.suffix.lower() not in FORMATOS:
        raise ValueError(f"Formato não suportado: {caminho.suffix}. Use {sorted(FORMATOS)}")
    caminho.parent.mkdir(parents=True, exist_ok=True)
    malha.export(caminho)
    return caminho
