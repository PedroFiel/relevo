"""tabelas do mvp [F3-T01]

usuarios, modelos, imagens (6 vistas, ADR 0007), jobs, versoes e arquivos, como em
docs/04-banco-de-dados.md, mais o usuário demo fixo do MVP (D10).

Revision ID: 59787083ad48
Revises: bf191ca87a91
Create Date: 2026-10-27 21:06:25.407946

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '59787083ad48'
down_revision: Union[str, Sequence[str], None] = 'bf191ca87a91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Copiado de relevo_api.models: a migração não importa o código da aplicação, que muda depois dela.
USUARIO_DEMO_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def upgrade() -> None:
    """Cria as tabelas do MVP e o usuário demo."""
    usuarios = op.create_table('usuarios',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('nome', sa.Text(), nullable=False),
    sa.Column('email', sa.Text(), nullable=False),
    sa.Column('senha_hash', sa.Text(), nullable=True),
    sa.Column('creditos', sa.Integer(), server_default='0', nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_usuarios')),
    sa.UniqueConstraint('email', name=op.f('uq_usuarios_email'))
    )
    op.create_table('modelos',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('usuario_id', sa.Uuid(), nullable=False),
    sa.Column('nome', sa.Text(), nullable=False),
    sa.Column('comprimento_cm', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='rascunho', nullable=False),
    sa.Column('versao_atual', sa.Integer(), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('rascunho', 'processando', 'pronto', 'erro')", name=op.f('ck_modelos_status')),
    sa.CheckConstraint('comprimento_cm BETWEEN 5 AND 60', name=op.f('ck_modelos_comprimento_cm')),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name=op.f('fk_modelos_usuario_id_usuarios'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_modelos'))
    )
    op.create_index(op.f('ix_modelos_usuario_id'), 'modelos', ['usuario_id'], unique=False)
    op.create_table('imagens',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('modelo_id', sa.Uuid(), nullable=False),
    sa.Column('vista', sa.String(length=20), nullable=False),
    sa.Column('caminho', sa.Text(), nullable=False),
    sa.Column('largura_px', sa.Integer(), nullable=False),
    sa.Column('altura_px', sa.Integer(), nullable=False),
    sa.Column('tamanho_bytes', sa.Integer(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("vista IN ('lateral', 'outro_lado', 'topo', 'sola', 'frente', 'tras')", name=op.f('ck_imagens_vista')),
    sa.ForeignKeyConstraint(['modelo_id'], ['modelos.id'], name=op.f('fk_imagens_modelo_id_modelos'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_imagens')),
    sa.UniqueConstraint('modelo_id', 'vista', name=op.f('uq_imagens_modelo_id_vista'))
    )
    op.create_table('jobs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('modelo_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='pendente', nullable=False),
    sa.Column('etapa_atual', sa.Text(), nullable=True),
    sa.Column('progresso', sa.Integer(), server_default='0', nullable=False),
    sa.Column('parametros', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('metricas', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('erro', sa.Text(), nullable=True),
    sa.Column('iniciado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finalizado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('pendente', 'processando', 'concluido', 'erro')", name=op.f('ck_jobs_status')),
    sa.CheckConstraint('progresso BETWEEN 0 AND 100', name=op.f('ck_jobs_progresso')),
    sa.ForeignKeyConstraint(['modelo_id'], ['modelos.id'], name=op.f('fk_jobs_modelo_id_modelos'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_jobs'))
    )
    op.create_index(op.f('ix_jobs_modelo_id'), 'jobs', ['modelo_id'], unique=False)
    op.create_index(op.f('ix_jobs_status'), 'jobs', ['status'], unique=False)
    op.create_table('versoes',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('modelo_id', sa.Uuid(), nullable=False),
    sa.Column('job_id', sa.Uuid(), nullable=True),
    sa.Column('numero', sa.Integer(), nullable=False),
    sa.Column('parametros', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('metricas', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('transformacao', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_versoes_job_id_jobs'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['modelo_id'], ['modelos.id'], name=op.f('fk_versoes_modelo_id_modelos'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_versoes')),
    sa.UniqueConstraint('modelo_id', 'numero', name=op.f('uq_versoes_modelo_id_numero'))
    )
    op.create_table('arquivos',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('versao_id', sa.Uuid(), nullable=False),
    sa.Column('tipo', sa.String(length=20), nullable=False),
    sa.Column('nome', sa.Text(), nullable=False),
    sa.Column('caminho', sa.Text(), nullable=False),
    sa.Column('tamanho_bytes', sa.Integer(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("tipo IN ('glb', 'obj', 'stl', 'textura', 'mascara', 'etapa')", name=op.f('ck_arquivos_tipo')),
    sa.ForeignKeyConstraint(['versao_id'], ['versoes.id'], name=op.f('fk_arquivos_versao_id_versoes'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_arquivos'))
    )
    op.create_index(op.f('ix_arquivos_versao_id'), 'arquivos', ['versao_id'], unique=False)

    op.bulk_insert(
        usuarios,
        [{"id": USUARIO_DEMO_ID, "nome": "Demo", "email": "demo@relevo.local", "creditos": 0}],
    )


def downgrade() -> None:
    """Apaga as tabelas na ordem inversa das chaves estrangeiras (o usuário demo vai junto)."""
    op.drop_index(op.f('ix_arquivos_versao_id'), table_name='arquivos')
    op.drop_table('arquivos')
    op.drop_table('versoes')
    op.drop_index(op.f('ix_jobs_status'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_modelo_id'), table_name='jobs')
    op.drop_table('jobs')
    op.drop_table('imagens')
    op.drop_index(op.f('ix_modelos_usuario_id'), table_name='modelos')
    op.drop_table('modelos')
    op.drop_table('usuarios')
