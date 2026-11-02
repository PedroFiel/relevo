"""Rotas de modelos: criar (F3-T03), listar, detalhar e apagar (F3-T06). Ver docs/05-api.md."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Form, Header, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from relevo_api.db import get_db, get_fabrica_sessao
from relevo_api.models import USUARIO_DEMO_ID
from relevo_api.schemas import (
    ModeloCriadoOut,
    ModeloDetalheOut,
    ModeloPublicoOut,
    ModeloResumoOut,
    NovaVersaoIn,
    RegerarModeloIn,
    VersaoOut,
)
from relevo_api.servicos import auth as servico_auth
from relevo_api.servicos import modelos as servico
from relevo_api.servicos.processamento import executar_job
from relevo_api.storage import Storage, get_storage

router = APIRouter(prefix="/modelos", tags=["modelos"])
router_publico = APIRouter(prefix="/publico", tags=["publico"])


def get_usuario_id(authorization: Annotated[str | None, Header()] = None) -> uuid.UUID:
    """Devolve o usuário do token JWT (`Bearer`) ou o usuário demo se sem cabeçalho (F4-T01)."""
    if not authorization:
        return USUARIO_DEMO_ID
    esquema, _, token = authorization.partition(" ")
    if esquema.lower() != "bearer" or not token.strip():
        raise servico.ErroPedido(401, "Cabeçalho Authorization inválido; use Bearer <token>.")
    return servico_auth.decodificar_token_jwt(token)


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


@router.post("/{modelo_id}/versoes", status_code=201)
def criar_versao(
    modelo_id: uuid.UUID,
    corpo: NovaVersaoIn,
    db: Db,
    storage: Arquivos,
    usuario_id: Usuario,
) -> VersaoOut:
    return servico.criar_versao_transformada(
        db, storage, usuario_id, modelo_id, corpo.transformacao
    )


@router.post("/{modelo_id}/versoes/{numero}/restaurar")
def restaurar_versao(
    modelo_id: uuid.UUID, numero: int, db: Db, usuario_id: Usuario
) -> ModeloDetalheOut:
    return servico.restaurar_versao(db, usuario_id, modelo_id, numero)


@router.post("/{modelo_id}/regerar", status_code=202)
def regerar(
    modelo_id: uuid.UUID,
    corpo: RegerarModeloIn,
    db: Db,
    storage: Arquivos,
    usuario_id: Usuario,
    tarefas: BackgroundTasks,
    fabrica: Annotated[Callable[[], Session], Depends(get_fabrica_sessao)],
) -> ModeloCriadoOut:
    job = servico.regerar_com_mascaras(
        db, storage, usuario_id, modelo_id, corpo.mascaras, corpo.resolucao
    )
    tarefas.add_task(executar_job, job.id, fabrica, storage)
    return ModeloCriadoOut(modelo_id=modelo_id, job_id=job.id)


@router_publico.get("/{modelo_id}")
def detalhar_publico(modelo_id: uuid.UUID, db: Db) -> ModeloPublicoOut:
    resumo, _ = servico.buscar_modelo_publico(db, modelo_id)
    return resumo


@router_publico.get("/{modelo_id}/glb")
def baixar_glb_publico(modelo_id: uuid.UUID, db: Db, storage: Arquivos) -> FileResponse:
    _, glb = servico.buscar_modelo_publico(db, modelo_id)
    caminho = storage.caminho_local(glb.caminho)
    if not caminho.is_file():
        raise servico.ErroPedido(404, "O arquivo não está mais no servidor.")
    return FileResponse(caminho, media_type="model/gltf-binary", filename=glb.nome)
