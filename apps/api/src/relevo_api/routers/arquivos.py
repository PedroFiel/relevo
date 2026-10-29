"""Download dos arquivos gerados e das fotos enviadas (F3-T06)."""

import uuid

from fastapi import APIRouter
from fastapi.responses import FileResponse

from relevo_api.routers.modelos import Arquivos, Db, Usuario
from relevo_api.servicos import modelos as servico

router = APIRouter(tags=["arquivos"])

TIPOS_MIDIA = {
    ".glb": "model/gltf-binary",
    ".obj": "model/obj",
    ".stl": "model/stl",
    ".png": "image/png",
    ".jpg": "image/jpeg",
}


def _resposta(storage: Arquivos, chave: str, nome: str | None = None) -> FileResponse:
    caminho = storage.caminho_local(chave)
    if not caminho.is_file():
        raise servico.ErroPedido(404, "O arquivo não está mais no servidor.")
    tipo = TIPOS_MIDIA.get(caminho.suffix.lower(), "application/octet-stream")
    return FileResponse(caminho, media_type=tipo, filename=nome)


@router.get("/arquivos/{arquivo_id}/download")
def baixar(arquivo_id: uuid.UUID, db: Db, storage: Arquivos, usuario_id: Usuario) -> FileResponse:
    arquivo = servico.buscar_arquivo(db, usuario_id, arquivo_id)
    return _resposta(storage, arquivo.caminho, arquivo.nome)


@router.get("/imagens/{imagem_id}")
def foto(imagem_id: uuid.UUID, db: Db, storage: Arquivos, usuario_id: Usuario) -> FileResponse:
    return _resposta(storage, servico.buscar_imagem(db, usuario_id, imagem_id).caminho)
