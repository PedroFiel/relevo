"""Rotas de autenticação (`/auth/registrar` e `/auth/login`, F4-T01)."""

from fastapi import APIRouter

from relevo_api.routers.modelos import Db
from relevo_api.schemas import LoginIn, RegistroIn, TokenOut
from relevo_api.servicos import auth as servico

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/registrar", status_code=201)
def registrar(corpo: RegistroIn, db: Db) -> TokenOut:
    return servico.registrar_usuario(db, corpo)


@router.post("/login")
def login(corpo: LoginIn, db: Db) -> TokenOut:
    return servico.autenticar_usuario(db, corpo)
