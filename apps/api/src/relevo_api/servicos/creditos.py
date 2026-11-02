"""Regras de saldo e extrato de créditos (F4-T02).

Cada geração de modelo (ou regeração com máscara corrigida) debita 1 crédito na mesma transação
em que o job é criado, usando `SELECT ... FOR UPDATE` na linha do usuário para impedir saldo
negativo sob concorrência. Se o job falhar (ou for interrompido), o crédito é estornado.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relevo_api.models import Job, MovimentoCredito, Usuario
from relevo_api.schemas import ContaOut, MovimentoCreditoOut
from relevo_api.servicos.modelos import ErroPedido

CREDITOS_RECARGA_DEMO = 10


def debitar_credito(
    db: Session, usuario_id: uuid.UUID, job_id: uuid.UUID, motivo: str = "geracao"
) -> None:
    """Debita 1 crédito com bloqueio da linha do usuário; lança 402 se não houver saldo."""
    usuario = db.scalar(select(Usuario).where(Usuario.id == usuario_id).with_for_update())
    if usuario is None:
        raise ErroPedido(404, "Usuário não encontrado.")
    if usuario.creditos < 1:
        raise ErroPedido(
            402,
            "Seus créditos acabaram. Adicione créditos na sua conta para gerar novos modelos.",
        )
    usuario.creditos -= 1
    db.add(
        MovimentoCredito(
            usuario_id=usuario.id,
            quantidade=-1,
            motivo=motivo,
            job_id=job_id,
            criado_em=datetime.now(UTC),
        )
    )


def estornar_credito_se_debitado(db: Session, job: Job) -> bool:
    """Devolve 1 crédito ao dono do modelo quando um job que debitou crédito falha."""
    debito = db.scalar(
        select(MovimentoCredito).where(
            MovimentoCredito.job_id == job.id, MovimentoCredito.quantidade < 0
        )
    )
    if debito is None:
        return False
    ja_estornado = db.scalar(
        select(MovimentoCredito).where(
            MovimentoCredito.job_id == job.id, MovimentoCredito.motivo == "estorno"
        )
    )
    if ja_estornado is not None:
        return False
    usuario = db.scalar(select(Usuario).where(Usuario.id == debito.usuario_id).with_for_update())
    if usuario is None:
        return False
    usuario.creditos += 1
    db.add(
        MovimentoCredito(
            usuario_id=usuario.id,
            quantidade=1,
            motivo="estorno",
            job_id=job.id,
            criado_em=datetime.now(UTC),
        )
    )
    return True


def obter_conta(db: Session, usuario_id: uuid.UUID) -> ContaOut:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise ErroPedido(404, "Usuário não encontrado.")
    movimentos = list(
        db.scalars(
            select(MovimentoCredito)
            .where(MovimentoCredito.usuario_id == usuario_id)
            .order_by(MovimentoCredito.criado_em.desc())
            .limit(50)
        )
    )
    return ContaOut(
        id=usuario.id,
        nome=usuario.nome,
        email=usuario.email,
        creditos=usuario.creditos,
        movimentos=[
            MovimentoCreditoOut(
                id=m.id,
                quantidade=m.quantidade,
                motivo=m.motivo,
                job_id=m.job_id,
                criado_em=m.criado_em,
            )
            for m in movimentos
        ],
    )


def recarregar_creditos(
    db: Session, usuario_id: uuid.UUID, quantidade: int = CREDITOS_RECARGA_DEMO
) -> ContaOut:
    if quantidade < 1 or quantidade > 100:
        raise ErroPedido(422, "A recarga deve ser entre 1 e 100 créditos.")
    usuario = db.scalar(select(Usuario).where(Usuario.id == usuario_id).with_for_update())
    if usuario is None:
        raise ErroPedido(404, "Usuário não encontrado.")
    usuario.creditos += quantidade
    db.add(
        MovimentoCredito(
            usuario_id=usuario.id,
            quantidade=quantidade,
            motivo="recarga_demo",
            job_id=None,
            criado_em=datetime.now(UTC),
        )
    )
    db.commit()
    return obter_conta(db, usuario_id)
