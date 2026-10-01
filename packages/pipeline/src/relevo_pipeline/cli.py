"""Linha de comando do pipeline.

Exemplos:
    uv run relevo-pipeline sintetico --pasta samples/sintetico
    uv run relevo-pipeline gerar --lateral samples/sintetico/lateral.png \
        --topo samples/sintetico/topo.png --frente samples/sintetico/frente.png \
        --comprimento-cm 28 --saida out/tenis.glb --debug out/debug
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from relevo_pipeline.exportar import exportar
from relevo_pipeline.pipeline import processar
from relevo_pipeline.segmentacao import carregar_imagem
from relevo_pipeline.sintetico import salvar_fotos


def _salvar_debug(resultado, pasta: Path) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, m in resultado.mascaras.items():
        cv2.imwrite(str(pasta / f"1_mascara_{nome}.png"), m.astype(np.uint8) * 255)
    v = resultado.vistas
    cv2.imwrite(str(pasta / "2_alinhada_lateral.png"), v.lateral.astype(np.uint8) * 255)
    cv2.imwrite(str(pasta / "2_alinhada_topo.png"), v.topo.astype(np.uint8) * 255)
    if v.frente is not None:
        cv2.imwrite(str(pasta / "2_alinhada_frente.png"), v.frente.astype(np.uint8) * 255)
    np.save(pasta / "3_voxels.npy", resultado.voxels)
    (pasta / "metricas.json").write_text(json.dumps(resultado.metricas, indent=2))


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="relevo-pipeline", description="RELEVO: 3 fotos -> 3D")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("sintetico", help="gera 3 fotos sintéticas de exemplo")
    s.add_argument("--pasta", default="samples/sintetico")

    g = sub.add_parser("gerar", help="gera o modelo 3D a partir das fotos")
    g.add_argument("--lateral", required=True)
    g.add_argument("--topo", required=True)
    g.add_argument("--frente")
    g.add_argument("--comprimento-cm", type=float, default=28.0)
    g.add_argument("--resolucao", type=int, default=128)
    g.add_argument("--saida", required=True, help="arquivo .glb, .obj ou .stl")
    g.add_argument("--debug", help="pasta para salvar as etapas intermediárias")

    a = p.parse_args(argv)
    if a.cmd == "sintetico":
        for nome, caminho in salvar_fotos(a.pasta).items():
            print(f"{nome}: {caminho}")
        return

    resultado = processar(
        carregar_imagem(a.lateral),
        carregar_imagem(a.topo),
        carregar_imagem(a.frente) if a.frente else None,
        comprimento_cm=a.comprimento_cm,
        resolucao=a.resolucao,
    )
    print(f"modelo salvo em {exportar(resultado.malha, a.saida)}")
    print(json.dumps(resultado.metricas, indent=2))
    if a.debug:
        _salvar_debug(resultado, Path(a.debug))


if __name__ == "__main__":
    main()
