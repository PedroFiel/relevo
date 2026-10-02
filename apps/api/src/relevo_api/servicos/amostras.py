"""Estúdio de desenvolvimento: regera o modelo de um tênis de `samples/reais/` com novos ajustes.

Enquanto o upload de verdade (Fase 3) não existe, é isto que faz o editor de fotos do front
(recortar/girar) refletir no 3D: grava o `ajustes.json` na pasta do tênis, roda o pipeline e
republica o `.glb`, as fotos e o `metricas.json` em `apps/web/public/samples/`.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

from relevo_pipeline.cli import ler_pasta, processar_fotos, publicar
from relevo_pipeline.exportar import exportar

from relevo_api.config import RAIZ_REPO

NOME_VALIDO = re.compile(r"^tenis-\d{2}$")  # só nomes do tipo tenis-03 (sem ../ nem barras)


class AmostraNaoEncontrada(Exception):
    pass


def regerar(
    tenis: str,
    ajustes: dict,
    comprimento_cm: float = 30.0,
    resolucao: int = 256,
    raiz: Path = RAIZ_REPO,
) -> dict:
    if not NOME_VALIDO.match(tenis):
        raise AmostraNaoEncontrada(tenis)
    pasta = raiz / "samples" / "reais" / tenis
    if not pasta.is_dir():
        raise AmostraNaoEncontrada(tenis)
    fotos, _ = ler_pasta(pasta)
    resultado = processar_fotos(fotos, ajustes, comprimento_cm, resolucao)  # ValueError -> 422
    # Só grava os ajustes depois que o pipeline aceitou (recorte válido etc.)
    usados = {
        v: a for v, a in ajustes.items() if a.get("rotacao_graus", 0) % 360 or a.get("recorte")
    }
    (pasta / "ajustes.json").write_text(json.dumps(usados, indent=2) + "\n", encoding="utf-8")
    publico = raiz / "apps" / "web" / "public" / "samples"
    exportar(resultado.malha, publico / f"{tenis}.glb")
    publicar(resultado, fotos, publico / tenis)
    resumo = {k: v for k, v in resultado.metricas.items() if k not in ("contornos",)}
    # Versão para o front pedir o .glb novo sem pegar o antigo do cache do navegador
    return {**resumo, "versao": time.time_ns()}
