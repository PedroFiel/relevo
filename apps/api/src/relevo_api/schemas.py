"""Schemas Pydantic da API (o que entra e sai das rotas). Contrato: docs/05-api.md."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ModeloCriadoOut(BaseModel):
    modelo_id: uuid.UUID
    job_id: uuid.UUID


class JobOut(BaseModel):
    id: uuid.UUID
    modelo_id: uuid.UUID
    status: str
    etapa_atual: str | None
    progresso: int
    etapas: list[str]
    erro: str | None


class ImagemOut(BaseModel):
    vista: str
    largura_px: int
    altura_px: int
    url: str


class ArquivoOut(BaseModel):
    id: uuid.UUID
    tipo: str
    nome: str
    tamanho_bytes: int
    url: str


class VersaoOut(BaseModel):
    numero: int
    metricas: dict | None
    arquivos: list[ArquivoOut]
    criado_em: datetime


class ModeloResumoOut(BaseModel):
    id: uuid.UUID
    nome: str
    status: str
    versao_atual: int | None
    miniatura_url: str | None
    atualizado_em: datetime


class ModeloDetalheOut(BaseModel):
    id: uuid.UUID
    nome: str
    status: str
    comprimento_cm: float
    imagens: list[ImagemOut]
    versao: VersaoOut | None
    # Último job: o front acompanha o processamento por ele (F3-T09)
    job: JobOut | None
    criado_em: datetime
    atualizado_em: datetime
