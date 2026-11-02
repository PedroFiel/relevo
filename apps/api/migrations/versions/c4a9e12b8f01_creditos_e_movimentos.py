"""creditos e movimentos [F4-T02]

Tabela movimentos_credito, restrição de saldo não-negativo em usuarios e
10 créditos iniciais de boas-vindas para o usuário demo.

Revision ID: c4a9e12b8f01
Revises: 59787083ad48
Create Date: 2026-11-02 13:15:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4a9e12b8f01"
down_revision: Union[str, Sequence[str], None] = "59787083ad48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USUARIO_DEMO_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MOVIMENTO_DEMO_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


def upgrade() -> None:
    """Cria movimentos_credito, impede saldo negativo e dá 10 créditos ao demo."""
    op.alter_column("usuarios", "creditos", server_default="10")
    op.create_check_constraint(
        op.f("ck_usuarios_creditos"), "usuarios", "creditos >= 0"
    )
    movimentos = op.create_table(
        "movimentos_credito",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["jobs.id"],
            name=op.f("fk_movimentos_credito_job_id_jobs"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            name=op.f("fk_movimentos_credito_usuario_id_usuarios"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_movimentos_credito")),
    )
    op.create_index(
        op.f("ix_movimentos_credito_usuario_id"),
        "movimentos_credito",
        ["usuario_id"],
        unique=False,
    )
    op.execute(
        sa.text("UPDATE usuarios SET creditos = 10 WHERE id = :id").bindparams(
            id=USUARIO_DEMO_ID
        )
    )
    op.bulk_insert(
        movimentos,
        [
            {
                "id": MOVIMENTO_DEMO_ID,
                "usuario_id": USUARIO_DEMO_ID,
                "quantidade": 10,
                "motivo": "boas-vindas",
                "job_id": None,
            }
        ],
    )


def downgrade() -> None:
    """Remove movimentos_credito e volta os créditos do demo para 0."""
    op.drop_index(
        op.f("ix_movimentos_credito_usuario_id"), table_name="movimentos_credito"
    )
    op.drop_table("movimentos_credito")
    op.execute(
        sa.text("UPDATE usuarios SET creditos = 0 WHERE id = :id").bindparams(
            id=USUARIO_DEMO_ID
        )
    )
    op.drop_constraint(op.f("ck_usuarios_creditos"), "usuarios", type_="check")
    op.alter_column("usuarios", "creditos", server_default="0")
