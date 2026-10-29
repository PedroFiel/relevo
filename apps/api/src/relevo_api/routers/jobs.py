"""Acompanhamento do processamento (F3-T06): o front consulta a cada segundo (F3-T09)."""

import uuid

from fastapi import APIRouter

from relevo_api.routers.modelos import Db, Usuario
from relevo_api.schemas import JobOut
from relevo_api.servicos import modelos as servico

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
def buscar(job_id: uuid.UUID, db: Db, usuario_id: Usuario) -> JobOut:
    return servico.job_out(servico.buscar_job(db, usuario_id, job_id))
