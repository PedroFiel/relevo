"""Modelos ORM do MVP (Fase 3). Fonte: docs/04-banco-de-dados.md.

Mudou alguma coluna aqui? Gere a migração (`uv run alembic revision --autogenerate`) e revise à mão.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from relevo_pipeline.vistas import VISTAS
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from relevo_api.db import Base

# Usuário fixo do MVP (D10): criado pela migração, todas as requisições usam ele até a F4.
USUARIO_DEMO_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# Listas dos CHECKs. As vistas vêm do pipeline: uma vista nova lá exige migração aqui.
NOMES_VISTAS = tuple(VISTAS)
STATUS_MODELO = ("rascunho", "processando", "pronto", "erro")
STATUS_JOB = ("pendente", "processando", "concluido", "erro")
TIPOS_ARQUIVO = ("glb", "obj", "stl", "textura", "mascara", "etapa")


def em(coluna: str, valores: tuple[str, ...]) -> str:
    """Texto de um CHECK `coluna IN (...)`."""
    return f"{coluna} IN ({', '.join(repr(v) for v in valores)})"


def _id() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


def _criado_em() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = _id()
    nome: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    senha_hash: Mapped[str | None] = mapped_column(Text)  # F4 (nulo no MVP)
    creditos: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    criado_em: Mapped[datetime] = _criado_em()

    modelos: Mapped[list[Modelo]] = relationship(back_populates="usuario")


class Modelo(Base):
    __tablename__ = "modelos"
    __table_args__ = (
        CheckConstraint(em("status", STATUS_MODELO), name="status"),
        CheckConstraint("comprimento_cm BETWEEN 5 AND 60", name="comprimento_cm"),
    )

    id: Mapped[uuid.UUID] = _id()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    nome: Mapped[str] = mapped_column(Text)
    comprimento_cm: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(
        String(20), default="rascunho", server_default="rascunho"
    )
    versao_atual: Mapped[int | None] = mapped_column(Integer)
    criado_em: Mapped[datetime] = _criado_em()
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    usuario: Mapped[Usuario] = relationship(back_populates="modelos")
    # passive_deletes: quem apaga as filhas é o ON DELETE CASCADE do banco
    imagens: Mapped[list[Imagem]] = relationship(
        back_populates="modelo", cascade="all, delete-orphan", passive_deletes=True
    )
    jobs: Mapped[list[Job]] = relationship(
        back_populates="modelo", cascade="all, delete-orphan", passive_deletes=True
    )
    versoes: Mapped[list[Versao]] = relationship(
        back_populates="modelo",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Versao.numero",
    )


class Imagem(Base):
    __tablename__ = "imagens"
    __table_args__ = (
        UniqueConstraint("modelo_id", "vista"),
        CheckConstraint(em("vista", NOMES_VISTAS), name="vista"),
    )

    id: Mapped[uuid.UUID] = _id()
    modelo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modelos.id", ondelete="CASCADE"))
    vista: Mapped[str] = mapped_column(String(20))
    caminho: Mapped[str] = mapped_column(Text)  # chave no Storage
    largura_px: Mapped[int] = mapped_column(Integer)
    altura_px: Mapped[int] = mapped_column(Integer)
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    criado_em: Mapped[datetime] = _criado_em()

    modelo: Mapped[Modelo] = relationship(back_populates="imagens")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(em("status", STATUS_JOB), name="status"),
        CheckConstraint("progresso BETWEEN 0 AND 100", name="progresso"),
    )

    id: Mapped[uuid.UUID] = _id()
    modelo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("modelos.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pendente", server_default="pendente", index=True
    )
    etapa_atual: Mapped[str | None] = mapped_column(Text)
    progresso: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    parametros: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    metricas: Mapped[dict | None] = mapped_column(JSONB)
    erro: Mapped[str | None] = mapped_column(Text)
    iniciado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finalizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = _criado_em()

    modelo: Mapped[Modelo] = relationship(back_populates="jobs")


class Versao(Base):
    __tablename__ = "versoes"
    __table_args__ = (UniqueConstraint("modelo_id", "numero"),)

    id: Mapped[uuid.UUID] = _id()
    modelo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modelos.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="SET NULL")
    )
    numero: Mapped[int] = mapped_column(Integer)
    parametros: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    metricas: Mapped[dict | None] = mapped_column(JSONB)
    transformacao: Mapped[list[float] | None] = mapped_column(JSONB)  # matriz 4×4 (F4)
    criado_em: Mapped[datetime] = _criado_em()

    modelo: Mapped[Modelo] = relationship(back_populates="versoes")
    job: Mapped[Job | None] = relationship()
    arquivos: Mapped[list[Arquivo]] = relationship(
        back_populates="versao", cascade="all, delete-orphan", passive_deletes=True
    )


class Arquivo(Base):
    __tablename__ = "arquivos"
    __table_args__ = (CheckConstraint(em("tipo", TIPOS_ARQUIVO), name="tipo"),)

    id: Mapped[uuid.UUID] = _id()
    versao_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("versoes.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[str] = mapped_column(String(20))
    nome: Mapped[str] = mapped_column(Text)
    caminho: Mapped[str] = mapped_column(Text)  # chave no Storage
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    criado_em: Mapped[datetime] = _criado_em()

    versao: Mapped[Versao] = relationship(back_populates="arquivos")
