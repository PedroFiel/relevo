"""Linha de comando do pipeline.

Exemplos:
    uv run relevo-pipeline sintetico --pasta samples/sintetico
    uv run relevo-pipeline gerar --pasta samples/reais/tenis-03 --saida out/t.glb
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

from relevo_pipeline.ajuste import ler_ajustes
from relevo_pipeline.exportar import exportar
from relevo_pipeline.pipeline import processar
from relevo_pipeline.segmentacao import carregar_imagem
from relevo_pipeline.sintetico import salvar_fotos
from relevo_pipeline.vistas import VISTAS

EXTENSOES = {".jpg", ".jpeg", ".png"}


def _salvar_debug(resultado, pasta: Path) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, m in resultado.mascaras.items():
        cv2.imwrite(str(pasta / f"1_mascara_{nome}.png"), m.astype(np.uint8) * 255)
    for nome, m in resultado.vistas.mascaras.items():
        cv2.imwrite(str(pasta / f"2_alinhada_{nome}.png"), m.astype(np.uint8) * 255)
    np.save(pasta / "3_voxels.npy", resultado.voxels)
    metricas = json.dumps(resultado.metricas, indent=2, ensure_ascii=False)
    (pasta / "metricas.json").write_text(metricas, encoding="utf-8")


def ler_pasta(pasta: Path) -> tuple[dict[str, Path], dict]:
    """Fotos nomeadas pela vista (lateral.jpg, topo.png, ...) e o ajustes.json, se houver."""
    fotos = {}
    for vista in VISTAS:
        achadas = sorted(c for c in pasta.glob(f"{vista}.*") if c.suffix.lower() in EXTENSOES)
        if achadas:
            fotos[vista] = achadas[0]
    arquivo_ajustes = pasta / "ajustes.json"
    ajustes = json.loads(arquivo_ajustes.read_text()) if arquivo_ajustes.exists() else {}
    return fotos, ajustes


def publicar(resultado, fotos: dict[str, Path], pasta: Path) -> None:
    """Fotos originais + métricas (com contornos) para a página "Fotos" do front."""
    (pasta / "fotos").mkdir(parents=True, exist_ok=True)
    for vista, caminho in fotos.items():
        cv2.imwrite(str(pasta / "fotos" / f"{vista}.jpg"), carregar_imagem(str(caminho)))
    metricas = json.dumps(resultado.metricas, ensure_ascii=False)
    (pasta / "metricas.json").write_text(metricas, encoding="utf-8")


def processar_fotos(
    fotos: dict[str, Path],
    ajustes: dict,
    comprimento_cm: float = 28.0,
    resolucao: int = 128,
    secao: bool = True,
):
    """Roda o pipeline a partir de caminhos de fotos (por vista) e do dicionário de ajustes.
    Usado pela CLI e pela API (estúdio do front)."""
    faltando = [v for v in VISTAS if VISTAS[v].obrigatoria and v not in fotos]
    if faltando:
        raise ValueError(f"Faltam as fotos obrigatórias: {', '.join(faltando)}.")
    imagens = {v: carregar_imagem(str(c)) for v, c in fotos.items()}
    return processar(
        imagens.pop("lateral"),
        imagens.pop("topo"),
        imagens.pop("frente", None),
        comprimento_cm=comprimento_cm,
        resolucao=resolucao,
        extras=imagens,
        ajustes=ler_ajustes(ajustes),
        secao=secao,
    )


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="relevo-pipeline", description="RELEVO: fotos -> 3D")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("sintetico", help="gera 3 fotos sintéticas de exemplo")
    s.add_argument("--pasta", default="samples/sintetico")

    g = sub.add_parser("gerar", help="gera o modelo 3D a partir das fotos")
    g.add_argument(
        "--pasta", help="pasta com as fotos nomeadas pela vista e, opcionalmente, ajustes.json"
    )
    for vista in VISTAS:
        g.add_argument(
            f"--{vista.replace('_', '-')}", dest=vista, help=f"foto {VISTAS[vista].rotulo}"
        )
    g.add_argument("--ajustes", help="JSON com recorte/rotação por vista (como o editor de fotos)")
    g.add_argument("--comprimento-cm", type=float, default=28.0)
    g.add_argument("--resolucao", type=int, default=128)
    g.add_argument("--sem-secao", action="store_true", help="usa só o visual hull, sem a seção")
    g.add_argument("--saida", required=True, help="arquivo .glb, .obj ou .stl")
    g.add_argument("--debug", help="pasta para salvar as etapas intermediárias")
    g.add_argument("--publicar", help="pasta para o front: fotos/ + metricas.json")

    a = p.parse_args(argv)
    if a.cmd == "sintetico":
        for nome, caminho in salvar_fotos(a.pasta).items():
            print(f"{nome}: {caminho}")
        return

    fotos, ajustes = ler_pasta(Path(a.pasta)) if a.pasta else ({}, {})
    fotos.update({v: Path(getattr(a, v)) for v in VISTAS if getattr(a, v)})  # flags vencem
    if a.ajustes:
        ajustes = json.loads(Path(a.ajustes).read_text())
    try:
        resultado = processar_fotos(fotos, ajustes, a.comprimento_cm, a.resolucao, not a.sem_secao)
    except ValueError as e:
        p.error(str(e))
    print(f"modelo salvo em {exportar(resultado.malha, a.saida)}")
    resumo = {k: v for k, v in resultado.metricas.items() if k not in ("contornos", "ajustes")}
    print(json.dumps(resumo, indent=2, ensure_ascii=False))
    if a.debug:
        _salvar_debug(resultado, Path(a.debug))
    if a.publicar:
        publicar(resultado, fotos, Path(a.publicar))


if __name__ == "__main__":
    main()
