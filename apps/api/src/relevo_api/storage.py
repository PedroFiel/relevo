"""Onde ficam as fotos enviadas e os arquivos gerados (`.glb`, intermediários).

O resto da API só conhece a interface `Storage` e fala em **chaves** (caminhos relativos com `/`,
gravados em `imagens.caminho` e `arquivos.caminho`). No MVP a implementação é o disco local
(`LocalStorage`); na Fase 4 entra o `S3Storage` com a mesma interface (F4-T08, decisão D9).

Chaves usadas:
    modelos/{modelo_id}/fotos/{vista}.{ext}
    modelos/{modelo_id}/v{n}/modelo.glb
    modelos/{modelo_id}/v{n}/etapas/...
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Protocol
from uuid import UUID

from relevo_api.config import settings

# Cada pedaço da chave: letras, números, `_`, `-` e `.`; nada de `..`, barra invertida ou espaço.
PEDACO_VALIDO = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]*$")


class ChaveInvalida(ValueError):
    """Chave com `..`, barra no começo, pedaço vazio ou caractere fora do permitido."""


def validar_chave(chave: str) -> str:
    """Devolve a chave se for segura; senão levanta `ChaveInvalida` (contra *path traversal*)."""
    pedacos = chave.split("/")
    if not chave or any(not PEDACO_VALIDO.match(p) or p in (".", "..") for p in pedacos):
        raise ChaveInvalida(f"chave de arquivo inválida: {chave!r}")
    return chave


def chave_foto(modelo_id: UUID, vista: str, ext: str) -> str:
    return validar_chave(f"modelos/{modelo_id}/fotos/{vista}.{ext}")


def chave_glb(modelo_id: UUID, numero_versao: int) -> str:
    return validar_chave(f"modelos/{modelo_id}/v{numero_versao}/modelo.glb")


def prefixo_modelo(modelo_id: UUID) -> str:
    return validar_chave(f"modelos/{modelo_id}")


class Storage(Protocol):
    def salvar(self, chave: str, dados: bytes) -> str:
        """Grava (ou substitui) o arquivo e devolve a chave."""
        ...

    def abrir(self, chave: str) -> bytes:
        """Lê o arquivo inteiro; `FileNotFoundError` se não existir."""
        ...

    def caminho_local(self, chave: str) -> Path:
        """Caminho no disco (para `FileResponse` e para o pipeline ler/gravar)."""
        ...

    def apagar_prefixo(self, prefixo: str) -> None:
        """Apaga tudo sob o prefixo (ex.: um modelo inteiro). Prefixo inexistente não é erro."""
        ...


class LocalStorage:
    """Storage em uma pasta do disco (`STORAGE_DIR`, padrão `storage/` na raiz do repo)."""

    def __init__(self, raiz: Path) -> None:
        self.raiz = Path(raiz).resolve()

    def caminho_local(self, chave: str) -> Path:
        caminho = (self.raiz / validar_chave(chave)).resolve()
        # Segunda barreira: mesmo com link simbólico no meio, nada sai da raiz
        if not caminho.is_relative_to(self.raiz):
            raise ChaveInvalida(f"chave de arquivo inválida: {chave!r}")
        return caminho

    def salvar(self, chave: str, dados: bytes) -> str:
        destino = self.caminho_local(chave)
        destino.parent.mkdir(parents=True, exist_ok=True)
        # Grava num temporário e troca de uma vez: quem lê nunca vê arquivo pela metade
        fd, temporario = tempfile.mkstemp(dir=destino.parent, prefix=".tmp-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(dados)
            os.replace(temporario, destino)
        except BaseException:
            Path(temporario).unlink(missing_ok=True)
            raise
        return chave

    def abrir(self, chave: str) -> bytes:
        return self.caminho_local(chave).read_bytes()

    def apagar_prefixo(self, prefixo: str) -> None:
        alvo = self.caminho_local(prefixo)
        if alvo.is_dir():
            shutil.rmtree(alvo)
        else:
            alvo.unlink(missing_ok=True)


@lru_cache
def get_storage() -> Storage:
    """Dependência do FastAPI; nos testes é trocada por um `LocalStorage(tmp_path)` (F3-T04)."""
    return LocalStorage(settings.storage_dir)
