"""Regras de criação, leitura e remoção de modelos (F3-T03, F3-T06).

As fotos chegam como bytes e são validadas pelo conteúdo, nunca pela extensão: assinatura
JPEG/PNG, tamanho e se o OpenCV consegue decodificar. Os ajustes (recorte/rotação) são testados
na própria foto antes de aceitar o pedido, para o erro aparecer na hora e não no meio do job.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from decimal import Decimal

import cv2
import numpy as np
from relevo_pipeline import ETAPAS
from relevo_pipeline.ajuste import aplicar_ajuste, ler_ajustes
from relevo_pipeline.vistas import VISTAS, validar_nomes
from sqlalchemy import select
from sqlalchemy.orm import Session

from relevo_api.models import Arquivo, Imagem, Job, Modelo, Versao
from relevo_api.schemas import (
    ArquivoOut,
    ImagemOut,
    JobOut,
    ModeloDetalheOut,
    ModeloResumoOut,
    VersaoOut,
)
from relevo_api.storage import Storage, chave_foto, prefixo_modelo

TAMANHO_MAXIMO = 10 * 1024 * 1024  # 10 MB por foto
ASSINATURAS = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png"}
# Etapas que o front mostra: as do pipeline + a exportação, feita aqui na API (docs/05-api.md)
ETAPAS_JOB = [*ETAPAS, "exportacao"]
FACES_ALVO = 20_000  # configuração única (F1-T03, ADR 0009)


class ErroPedido(Exception):
    """Pedido recusado com uma mensagem para o usuário e o status HTTP certo."""

    def __init__(self, status: int, mensagem: str) -> None:
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


@dataclass
class FotoValida:
    vista: str
    dados: bytes
    ext: str
    imagem: np.ndarray

    @property
    def altura(self) -> int:
        return int(self.imagem.shape[0])

    @property
    def largura(self) -> int:
        return int(self.imagem.shape[1])


def validar_foto(vista: str, dados: bytes) -> FotoValida:
    rotulo = VISTAS[vista].rotulo
    if len(dados) > TAMANHO_MAXIMO:
        raise ErroPedido(
            413, f"A foto {rotulo} passa de 10 MB. Diminua a resolução ou envie em JPEG."
        )
    ext = next((e for assinatura, e in ASSINATURAS.items() if dados.startswith(assinatura)), None)
    if ext is None:
        raise ErroPedido(400, f"A foto {rotulo} não é JPEG nem PNG. Envie nesses formatos.")
    imagem = cv2.imdecode(np.frombuffer(dados, np.uint8), cv2.IMREAD_COLOR)
    if imagem is None:
        raise ErroPedido(400, f"Não conseguimos abrir a foto {rotulo}: o arquivo está corrompido?")
    return FotoValida(vista, dados, ext, imagem)


def validar_ajustes(texto: str | None, fotos: dict[str, FotoValida]) -> dict:
    """JSON de ajustes -> dicionário validado (aplicado de verdade em cada foto)."""
    if not texto:
        return {}
    try:
        bruto = json.loads(texto)
        if not isinstance(bruto, dict) or not all(isinstance(v, dict) for v in bruto.values()):
            raise ValueError("Os ajustes precisam ser um objeto por vista.")
        validar_nomes(bruto)
        sem_foto = sorted(set(bruto) - set(fotos))
        if sem_foto:
            raise ValueError(f"Há ajuste para vista sem foto: {', '.join(sem_foto)}.")
        ajustes = ler_ajustes(bruto)
        for vista, ajuste in ajustes.items():
            aplicar_ajuste(fotos[vista].imagem, ajuste)
    except json.JSONDecodeError:
        raise ErroPedido(422, "Os ajustes não são um JSON válido.") from None
    except (ValueError, TypeError) as e:
        raise ErroPedido(422, str(e)) from None
    return {v: a.para_dict() for v, a in ajustes.items()}


def criar_modelo(
    db: Session,
    storage: Storage,
    usuario_id: uuid.UUID,
    nome: str,
    comprimento_cm: float,
    fotos: dict[str, bytes],
    ajustes_json: str | None,
    resolucao: int,
) -> tuple[Modelo, Job]:
    validas = {vista: validar_foto(vista, dados) for vista, dados in fotos.items()}
    ajustes = validar_ajustes(ajustes_json, validas)

    modelo = Modelo(
        usuario_id=usuario_id,
        nome=nome.strip(),
        comprimento_cm=Decimal(str(comprimento_cm)),
        status="processando",
    )
    db.add(modelo)
    db.flush()  # gera o id usado nas chaves do Storage
    try:
        for foto in validas.values():
            modelo.imagens.append(
                Imagem(
                    vista=foto.vista,
                    caminho=storage.salvar(chave_foto(modelo.id, foto.vista, foto.ext), foto.dados),
                    largura_px=foto.largura,
                    altura_px=foto.altura,
                    tamanho_bytes=len(foto.dados),
                )
            )
        job = Job(
            status="pendente",
            parametros={"resolucao": resolucao, "faces_alvo": FACES_ALVO, "ajustes": ajustes},
        )
        modelo.jobs.append(job)
        db.commit()
    except BaseException:
        db.rollback()
        storage.apagar_prefixo(prefixo_modelo(modelo.id))
        raise
    return modelo, job


# ---------- Leitura (F3-T06) ----------
def buscar_modelo(db: Session, usuario_id: uuid.UUID, modelo_id: uuid.UUID) -> Modelo:
    modelo = db.get(Modelo, modelo_id)
    if modelo is None or modelo.usuario_id != usuario_id:
        raise ErroPedido(404, "Modelo não encontrado.")
    return modelo


def buscar_job(db: Session, usuario_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    job = db.get(Job, job_id)
    if job is None or job.modelo.usuario_id != usuario_id:
        raise ErroPedido(404, "Processamento não encontrado.")
    return job


def buscar_arquivo(db: Session, usuario_id: uuid.UUID, arquivo_id: uuid.UUID) -> Arquivo:
    arquivo = db.get(Arquivo, arquivo_id)
    if arquivo is None or arquivo.versao.modelo.usuario_id != usuario_id:
        raise ErroPedido(404, "Arquivo não encontrado.")
    return arquivo


def buscar_imagem(db: Session, usuario_id: uuid.UUID, imagem_id: uuid.UUID) -> Imagem:
    imagem = db.get(Imagem, imagem_id)
    if imagem is None or imagem.modelo.usuario_id != usuario_id:
        raise ErroPedido(404, "Foto não encontrada.")
    return imagem


def listar_modelos(db: Session, usuario_id: uuid.UUID) -> list[ModeloResumoOut]:
    modelos = db.scalars(
        select(Modelo)
        .where(Modelo.usuario_id == usuario_id)
        .order_by(Modelo.atualizado_em.desc(), Modelo.criado_em.desc())
    )
    return [
        ModeloResumoOut(
            id=m.id,
            nome=m.nome,
            status=m.status,
            versao_atual=m.versao_atual,
            miniatura_url=_url_miniatura(m),
            atualizado_em=m.atualizado_em,
        )
        for m in modelos
    ]


def apagar_modelo(db: Session, storage: Storage, modelo: Modelo) -> None:
    """Apaga as linhas (as filhas vão em cascata no banco) e depois os arquivos no Storage."""
    modelo_id = modelo.id
    db.delete(modelo)
    db.commit()
    storage.apagar_prefixo(prefixo_modelo(modelo_id))


def job_out(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        modelo_id=job.modelo_id,
        status=job.status,
        etapa_atual=job.etapa_atual,
        progresso=job.progresso,
        etapas=ETAPAS_JOB,
        erro=job.erro,
    )


def detalhe(modelo: Modelo) -> ModeloDetalheOut:
    versao = next((v for v in modelo.versoes if v.numero == modelo.versao_atual), None)
    ultimo_job = max(modelo.jobs, key=lambda j: j.criado_em, default=None)
    ordem = list(VISTAS)
    return ModeloDetalheOut(
        id=modelo.id,
        nome=modelo.nome,
        status=modelo.status,
        comprimento_cm=float(modelo.comprimento_cm),
        imagens=[
            ImagemOut(
                vista=i.vista, largura_px=i.largura_px, altura_px=i.altura_px, url=_url_imagem(i)
            )
            for i in sorted(modelo.imagens, key=lambda i: ordem.index(i.vista))
        ],
        versao=_versao_out(versao) if versao else None,
        job=job_out(ultimo_job) if ultimo_job else None,
        criado_em=modelo.criado_em,
        atualizado_em=modelo.atualizado_em,
    )


def _versao_out(versao: Versao) -> VersaoOut:
    return VersaoOut(
        numero=versao.numero,
        metricas=versao.metricas,
        criado_em=versao.criado_em,
        arquivos=[
            ArquivoOut(
                id=a.id,
                tipo=a.tipo,
                nome=a.nome,
                tamanho_bytes=a.tamanho_bytes,
                url=f"/arquivos/{a.id}/download",
            )
            for a in versao.arquivos
        ],
    )


def _url_imagem(imagem: Imagem) -> str:
    return f"/imagens/{imagem.id}"


def _url_miniatura(modelo: Modelo) -> str | None:
    lateral = next((i for i in modelo.imagens if i.vista == "lateral"), None)
    return _url_imagem(lateral) if lateral else None
