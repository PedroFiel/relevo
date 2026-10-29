"""Rotas de modelos: criar (F3-T03), listar, detalhar e apagar (F3-T06). Ver docs/05-api.md."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Form, Response, UploadFile
from sqlalchemy.orm import Session

from relevo_api.db import get_db, get_fabrica_sessao
from relevo_api.models import USUARIO_DEMO_ID
from relevo_api.schemas import ModeloCriadoOut, ModeloDetalheOut, ModeloResumoOut
from relevo_api.servicos import modelos as servico
from relevo_api.servicos.processamento import executar_job
from relevo_api.storage import Storage, get_storage

router = APIRouter(prefix="/modelos", tags=["modelos"])


def get_usuario_id() -> uuid.UUID:
    """Usuário fixo do MVP (D10); vira o usuário do token JWT na F4-T01."""
    return USUARIO_DEMO_ID


Db = Annotated[Session, Depends(get_db)]
Arquivos = Annotated[Storage, Depends(get_storage)]
Usuario = Annotated[uuid.UUID, Depends(get_usuario_id)]


@router.post("", status_code=202)
def criar(
    db: Db,
    storage: Arquivos,
    usuario_id: Usuario,
    tarefas: BackgroundTasks,
    fabrica: Annotated[Callable[[], Session], Depends(get_fabrica_sessao)],
    nome: Annotated[str, Form(min_length=1, max_length=80)],
    comprimento_cm: Annotated[float, Form(ge=5, le=60)],
    lateral: UploadFile,
    topo: UploadFile,
    frente: UploadFile | None = None,
    outro_lado: UploadFile | None = None,
    sola: UploadFile | None = None,
    tras: UploadFile | None = None,
    resolucao: Annotated[int, Form(ge=64, le=192)] = 128,
    ajustes: Annotated[str | None, Form()] = None,
) -> ModeloCriadoOut:
    enviadas = {
        "lateral": lateral,
        "topo": topo,
        "frente": frente,
        "outro_lado": outro_lado,
        "sola": sola,
        "tras": tras,
    }
    # Lê 1 byte além do limite: basta para saber se passou de 10 MB sem carregar tudo
    fotos = {
        vista: arquivo.file.read(servico.TAMANHO_MAXIMO + 1)
        for vista, arquivo in enviadas.items()
        if arquivo is not None
    }
    modelo, job = servico.criar_modelo(
        db, storage, usuario_id, nome, comprimento_cm, fotos, ajustes, resolucao
    )
    tarefas.add_task(executar_job, job.id, fabrica, storage)
    return ModeloCriadoOut(modelo_id=modelo.id, job_id=job.id)


@router.get("")
def listar(db: Db, usuario_id: Usuario) -> list[ModeloResumoOut]:
    return servico.listar_modelos(db, usuario_id)


@router.get("/{modelo_id}")
def detalhar(modelo_id: uuid.UUID, db: Db, usuario_id: Usuario) -> ModeloDetalheOut:
    return servico.detalhe(servico.buscar_modelo(db, usuario_id, modelo_id))


@router.delete("/{modelo_id}", status_code=204)
def apagar(modelo_id: uuid.UUID, db: Db, storage: Arquivos, usuario_id: Usuario) -> Response:
    servico.apagar_modelo(db, storage, servico.buscar_modelo(db, usuario_id, modelo_id))
    return Response(status_code=204)
