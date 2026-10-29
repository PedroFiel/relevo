"""Execução do job em segundo plano (F3-T05): fotos do Storage -> pipeline -> `.glb` + versão.

Roda depois da resposta 202, com **sessão própria** (a da requisição já fechou). A cada etapa o
callback do pipeline grava `etapa_atual` e `progresso` no job — é o que o front acompanha por
*polling*. O pipeline vai até 90 %; a exportação (feita aqui) fecha os 10 % finais.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime

import cv2
import numpy as np
from relevo_pipeline import processar
from relevo_pipeline.ajuste import ler_ajustes
from relevo_pipeline.exportar import intermediarios
from relevo_pipeline.pipeline import ETAPA_FINAL
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from relevo_api.models import Arquivo, Job, Modelo, Versao
from relevo_api.storage import Storage, chave_etapa, chave_glb, prefixo_modelo

log = logging.getLogger(__name__)

PROGRESSO_PIPELINE = 90  # o resto é a exportação
ERRO_GENERICO = (
    "Não conseguimos gerar o modelo por um erro interno. Tente de novo; se repetir, tente com "
    "outras fotos."
)
ERRO_INTERROMPIDO = "O processamento parou porque o servidor reiniciou. Envie as fotos de novo."


def executar_job(job_id: uuid.UUID, fabrica: Callable[[], Session], storage: Storage) -> None:
    try:
        with fabrica() as db:
            _executar(db, storage, job_id)
    except Exception as e:
        with fabrica() as db:
            job = db.get(Job, job_id)
            if job is None:
                # O usuário apagou o modelo no meio do job: nada a avisar, mas o job pode ter
                # salvo arquivos depois do DELETE — limpa o que sobrou no Storage
                log.info("job %s parou: o modelo foi apagado", job_id)
                if isinstance(e, ModeloApagado):
                    storage.apagar_prefixo(prefixo_modelo(e.modelo_id))
                return
            # Mensagens de ValueError do pipeline já são para o usuário; o resto vira genérica
            mensagem = str(e) if isinstance(e, ValueError) else ERRO_GENERICO
            log.exception("job %s falhou", job_id)
            _marcar_erro(db, job, mensagem)


class ModeloApagado(Exception):
    def __init__(self, modelo_id: uuid.UUID) -> None:
        super().__init__(f"modelo {modelo_id} apagado durante o job")
        self.modelo_id = modelo_id


def _executar(db: Session, storage: Storage, job_id: uuid.UUID) -> None:
    job = db.get(Job, job_id)
    if job is None:  # o modelo foi apagado antes do job começar
        return
    modelo = job.modelo
    modelo_id = modelo.id

    def gravar() -> None:
        try:
            db.commit()
        except (StaleDataError, IntegrityError):
            # UPDATE sem linha ou versão sem modelo: foi apagado (DELETE) enquanto rodava?
            db.rollback()
            if db.get(Modelo, modelo_id) is None:
                raise ModeloApagado(modelo_id) from None
            raise

    job.status, job.iniciado_em, job.progresso = "processando", datetime.now(UTC), 0
    gravar()

    def ao_progredir(etapa: str, percentual: int) -> None:
        job.etapa_atual = "exportacao" if etapa == ETAPA_FINAL else etapa
        job.progresso = round(percentual * PROGRESSO_PIPELINE / 100)
        gravar()

    fotos = {i.vista: _decodificar(storage.abrir(i.caminho)) for i in modelo.imagens}
    parametros = job.parametros
    resultado = processar(
        fotos.pop("lateral"),
        fotos.pop("topo"),
        fotos.pop("frente", None),
        comprimento_cm=float(modelo.comprimento_cm),
        resolucao=int(parametros.get("resolucao", 128)),
        extras=fotos,
        ajustes=ler_ajustes(parametros.get("ajustes", {})),
        faces_alvo=parametros.get("faces_alvo"),
        ao_progredir=ao_progredir,
    )

    numero = (
        db.scalar(select(func.max(Versao.numero)).where(Versao.modelo_id == modelo.id)) or 0
    ) + 1
    glb = resultado.malha.export(file_type="glb")
    caminho = storage.salvar(chave_glb(modelo.id, numero), glb)
    metricas = resultado.metricas
    arquivos = [Arquivo(tipo="glb", nome="modelo.glb", caminho=caminho, tamanho_bytes=len(glb))]
    # Raio-X (F5-T01): máscaras, voxels de superfície e malha bruta
    for nome, dados in intermediarios(resultado).items():
        arquivos.append(
            Arquivo(
                tipo="mascara" if nome.startswith("mascara-") else "etapa",
                nome=nome,
                caminho=storage.salvar(chave_etapa(modelo.id, numero, nome), dados),
                tamanho_bytes=len(dados),
            )
        )
    versao = Versao(
        modelo_id=modelo.id,
        job_id=job.id,
        numero=numero,
        parametros=parametros,
        metricas=metricas,
        arquivos=arquivos,
    )
    db.add(versao)
    job.status, job.progresso, job.erro = "concluido", 100, None
    job.finalizado_em = datetime.now(UTC)
    job.metricas = {"tempos_s": metricas["tempos_s"], "resolucao": parametros.get("resolucao")}
    modelo.status, modelo.versao_atual = "pronto", numero
    gravar()


def _decodificar(dados: bytes) -> np.ndarray:
    imagem = cv2.imdecode(np.frombuffer(dados, np.uint8), cv2.IMREAD_COLOR)
    if imagem is None:
        raise ValueError("Uma das fotos salvas não abriu mais. Envie as fotos de novo.")
    return imagem


def _marcar_erro(db: Session, job: Job, mensagem: str) -> None:
    job.status, job.erro, job.finalizado_em = "erro", mensagem, datetime.now(UTC)
    job.modelo.status = "erro"
    db.commit()


def marcar_interrompidos(db: Session) -> int:
    """No *startup*: job pendente ou rodando quando a API caiu nunca vai terminar -> erro
    (as BackgroundTasks vivem só na memória do processo)."""
    abertos = Job.status.in_(("pendente", "processando"))
    presos = select(Job.modelo_id).where(abertos)
    db.execute(
        update(Modelo).where(Modelo.id.in_(presos)).values(status="erro"),
        execution_options={"synchronize_session": False},
    )
    resultado = db.execute(
        update(Job)
        .where(abertos)
        .values(status="erro", erro=ERRO_INTERROMPIDO, finalizado_em=func.now()),
        execution_options={"synchronize_session": False},
    )
    db.commit()
    return resultado.rowcount
