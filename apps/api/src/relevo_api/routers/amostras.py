"""Rotas do estúdio de desenvolvimento (amostras em samples/reais)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from relevo_api.servicos.amostras import AmostraNaoEncontrada, regerar

router = APIRouter(prefix="/amostras", tags=["estúdio (desenvolvimento)"])


class PedidoRegerar(BaseModel):
    ajustes: dict[str, dict] = Field(default_factory=dict)
    comprimento_cm: float = Field(30.0, ge=5, le=60)
    resolucao: int = Field(256, ge=64, le=320)


@router.post("/{tenis}/gerar")
def gerar(tenis: str, pedido: PedidoRegerar) -> dict:
    try:
        return regerar(tenis, pedido.ajustes, pedido.comprimento_cm, pedido.resolucao)
    except AmostraNaoEncontrada:
        raise HTTPException(404, f"Não achamos as fotos de '{tenis}' em samples/reais.") from None
    except ValueError as e:  # mensagens do pipeline já são para o usuário
        raise HTTPException(422, str(e)) from None
