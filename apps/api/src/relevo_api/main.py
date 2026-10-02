"""Ponto de entrada da API. Rodar com: uv run uvicorn relevo_api.main:app --reload"""

import relevo_pipeline
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from relevo_api.config import settings
from relevo_api.db import banco_disponivel
from relevo_api.routers import amostras

app = FastAPI(title="RELEVO API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(amostras.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "pipeline": relevo_pipeline.__version__}


@app.get("/health/db")
def health_db() -> dict:
    return {"banco": "ok" if banco_disponivel() else "indisponivel"}
