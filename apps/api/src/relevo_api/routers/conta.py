"""Rotas de conta e créditos (F4-T02): saldo, extrato de movimentos e recarga demo."""

from fastapi import APIRouter

from relevo_api.routers.modelos import Db, Usuario
from relevo_api.schemas import ContaOut
from relevo_api.servicos import creditos as servico

router = APIRouter(tags=["conta"])


@router.get("/me")
def me(db: Db, usuario_id: Usuario) -> ContaOut:
    return servico.obter_conta(db, usuario_id)


@router.post("/creditos/recarregar")
def recarregar(db: Db, usuario_id: Usuario, quantidade: int = 10) -> ContaOut:
    return servico.recarregar_creditos(db, usuario_id, quantidade=quantidade)
