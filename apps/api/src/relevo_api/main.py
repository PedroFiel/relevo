"""Ponto de entrada da API. Rodar com: uv run uvicorn relevo_api.main:app --reload"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import relevo_pipeline
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from relevo_api.config import settings
from relevo_api.db import banco_disponivel, get_fabrica_sessao
from relevo_api.routers import amostras, arquivos, jobs, modelos
from relevo_api.servicos.modelos import ErroPedido
from relevo_api.servicos.processamento import marcar_interrompidos

log = logging.getLogger(__name__)


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI) -> AsyncIterator[None]:
    # Fora de uma requisição o Depends não age: pega a fábrica (ou a troca dos testes) à mão
    fabrica = app.dependency_overrides.get(get_fabrica_sessao, get_fabrica_sessao)()
    try:
        with fabrica() as db:
            if n := marcar_interrompidos(db):
                log.warning("%d job(s) interrompido(s) marcados como erro", n)
    except SQLAlchemyError:
        # Sem banco a API sobe mesmo assim; o /health/db mostra o problema
        log.exception("não deu para conferir os jobs interrompidos")
    yield


app = FastAPI(title="RELEVO API", version="0.1.0", lifespan=ciclo_de_vida)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(modelos.router)
app.include_router(jobs.router)
app.include_router(arquivos.router)
app.include_router(amostras.router)


@app.exception_handler(ErroPedido)
def erro_pedido(_: Request, e: ErroPedido) -> JSONResponse:
    return JSONResponse({"detail": e.mensagem}, status_code=e.status)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "pipeline": relevo_pipeline.__version__}


@app.get("/health/db")
def health_db() -> dict:
    return {"banco": "ok" if banco_disponivel() else "indisponivel"}
