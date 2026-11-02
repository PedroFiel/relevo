"""Regras de criação, leitura e remoção de modelos (F3-T03, F3-T06).

As fotos chegam como bytes e são validadas pelo conteúdo, nunca pela extensão: assinatura
JPEG/PNG, tamanho e se o OpenCV consegue decodificar. Os ajustes (recorte/rotação) são testados
na própria foto antes de aceitar o pedido, para o erro aparecer na hora e não no meio do job.
"""

from __future__ import annotations

import base64
import io
import json
import uuid
from dataclasses import dataclass
from decimal import Decimal

import cv2
import numpy as np
import trimesh
from relevo_pipeline import ETAPAS
from relevo_pipeline.ajuste import aplicar_ajuste, ler_ajustes
from relevo_pipeline.vistas import VISTAS, validar_nomes
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from relevo_api.models import Arquivo, Imagem, Job, Modelo, Versao
from relevo_api.schemas import (
    ArquivoOut,
    ImagemOut,
    JobOut,
    ModeloDetalheOut,
    ModeloPublicoOut,
    ModeloResumoOut,
    VersaoOut,
    VersaoResumoOut,
)
from relevo_api.storage import (
    Storage,
    chave_exportado,
    chave_foto,
    chave_glb,
    chave_mascara_corrigida,
    prefixo_modelo,
)

TAMANHO_MAXIMO = 10 * 1024 * 1024  # 10 MB por foto
ASSINATURAS = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png"}
FORMATOS_EXPORTACAO = ("glb", "obj", "stl")
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
    from relevo_api.servicos.creditos import debitar_credito

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
        db.flush()
        debitar_credito(db, usuario_id, job.id, motivo="geracao")
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


def buscar_versao(db: Session, usuario_id: uuid.UUID, versao_id: uuid.UUID) -> Versao:
    versao = db.get(Versao, versao_id)
    if versao is None or versao.modelo.usuario_id != usuario_id:
        raise ErroPedido(404, "Versão não encontrada.")
    return versao


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


# ---------- Exportação em múltiplos formatos (F4-T05) ----------
def exportar_versao(
    db: Session, storage: Storage, usuario_id: uuid.UUID, versao_id: uuid.UUID, formato: str
) -> Arquivo:
    """Gera (ou devolve do cache) o arquivo `.glb`, `.obj` ou `.stl` de uma versão (F4-T05)."""
    formato = formato.lower().lstrip(".")
    if formato not in FORMATOS_EXPORTACAO:
        raise ErroPedido(
            422, f"Formato não suportado: {formato}. Escolha entre glb, obj ou stl."
        )
    versao = buscar_versao(db, usuario_id, versao_id)
    existente = next((a for a in versao.arquivos if a.tipo == formato), None)
    if existente is not None and storage.caminho_local(existente.caminho).is_file():
        return existente

    glb_arq = next((a for a in versao.arquivos if a.tipo == "glb"), None)
    if glb_arq is None or not storage.caminho_local(glb_arq.caminho).is_file():
        raise ErroPedido(404, "O arquivo 3D desta versão não está mais no servidor.")

    malha = trimesh.load(
        io.BytesIO(storage.abrir(glb_arq.caminho)), file_type="glb", force="mesh"
    )
    if formato == "stl":
        # STL não guarda cor: limpa o visual para exportar geometria pura e fechada
        copia = malha.copy()
        copia.visual = trimesh.visual.ColorVisuals(copia)
        exportado = copia.export(file_type="stl")
    else:
        exportado = malha.export(file_type=formato)
    dados = exportado.encode("utf-8") if isinstance(exportado, str) else bytes(exportado)

    chave = chave_exportado(versao.modelo_id, versao.numero, formato)
    storage.salvar(chave, dados)
    if existente is not None:
        existente.caminho = chave
        existente.tamanho_bytes = len(dados)
        db.commit()
        return existente

    novo = Arquivo(
        versao_id=versao.id,
        tipo=formato,
        nome=f"modelo.{formato}",
        caminho=chave,
        tamanho_bytes=len(dados),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


# ---------- Versões por matriz de transformação 4×4 (F4-T04) ----------
def criar_versao_transformada(
    db: Session,
    storage: Storage,
    usuario_id: uuid.UUID,
    modelo_id: uuid.UUID,
    transformacao: list[float],
) -> VersaoOut:
    """Aplica a matriz homogênea 4×4 (row-major, `src/lib/matrizes.ts`) e cria nova versão."""
    if len(transformacao) != 16 or not all(np.isfinite(transformacao)):
        raise ErroPedido(422, "A matriz de transformação precisa ter 16 números válidos.")
    matriz = np.array(transformacao, dtype=np.float64).reshape(4, 4)
    if not np.allclose(matriz[3, :], [0.0, 0.0, 0.0, 1.0], atol=1e-6):
        if np.allclose(matriz[:, 3], [0.0, 0.0, 0.0, 1.0], atol=1e-6):
            matriz = matriz.T
        else:
            raise ErroPedido(
                422,
                "A matriz de transformação precisa ser afim homogênea (última linha [0, 0, 0, 1]).",
            )
    if abs(float(np.linalg.det(matriz[:3, :3]))) < 1e-6:
        raise ErroPedido(422, "A transformação colapsa o modelo (escala zero ou inválida).")

    modelo = buscar_modelo(db, usuario_id, modelo_id)
    versao_base = next((v for v in modelo.versoes if v.numero == modelo.versao_atual), None)
    if versao_base is None:
        raise ErroPedido(409, "O modelo ainda não tem uma versão pronta para transformar.")
    glb_base = next((a for a in versao_base.arquivos if a.tipo == "glb"), None)
    if glb_base is None or not storage.caminho_local(glb_base.caminho).is_file():
        raise ErroPedido(404, "O arquivo 3D da versão atual não está no servidor.")

    malha = trimesh.load(
        io.BytesIO(storage.abrir(glb_base.caminho)), file_type="glb", force="mesh"
    )
    malha.apply_transform(matriz)
    malha.fix_normals()
    glb_novo = malha.export(file_type="glb")

    numero = (
        db.scalar(select(func.max(Versao.numero)).where(Versao.modelo_id == modelo.id)) or 0
    ) + 1
    caminho = storage.salvar(chave_glb(modelo.id, numero), glb_novo)
    metricas = dict(versao_base.metricas or {})
    metricas["dimensoes_cm"] = [round(float(v), 2) for v in malha.extents]
    metricas["fechada"] = bool(malha.is_watertight)

    arquivos = [
        Arquivo(tipo="glb", nome="modelo.glb", caminho=caminho, tamanho_bytes=len(glb_novo))
    ]
    # Reaproveita os arquivos do Raio-X da versão base para a aba Raio-X continuar completa
    for a in versao_base.arquivos:
        if a.tipo in ("mascara", "etapa"):
            arquivos.append(
                Arquivo(
                    tipo=a.tipo,
                    nome=a.nome,
                    caminho=a.caminho,
                    tamanho_bytes=a.tamanho_bytes,
                )
            )

    nova = Versao(
        modelo_id=modelo.id,
        job_id=versao_base.job_id,
        numero=numero,
        parametros=dict(versao_base.parametros or {}),
        metricas=metricas,
        transformacao=[round(float(x), 6) for x in transformacao],
        arquivos=arquivos,
    )
    db.add(nova)
    modelo.versao_atual = numero
    db.commit()
    db.refresh(nova)
    return _versao_out(nova)


def restaurar_versao(
    db: Session, usuario_id: uuid.UUID, modelo_id: uuid.UUID, numero: int
) -> ModeloDetalheOut:
    """Aponta `versao_atual` do modelo para uma versão existente (F4-T04)."""
    modelo = buscar_modelo(db, usuario_id, modelo_id)
    alvo = next((v for v in modelo.versoes if v.numero == numero), None)
    if alvo is None:
        raise ErroPedido(404, f"Versão {numero} não encontrada neste modelo.")
    modelo.versao_atual = numero
    db.commit()
    db.refresh(modelo)
    return detalhe(modelo)


# ---------- Regerar modelo com máscaras corrigidas pelo pincel (F5-T05) ----------
def _decodificar_mascara_b64(vista: str, conteudo: str, esperado: tuple[int, int]) -> bytes:
    """Valida PNG (em base64 ou data URL) da máscara corrigida e confere dimensões."""
    rotulo = VISTAS[vista].rotulo
    texto = conteudo.split(",", 1)[1] if "," in conteudo else conteudo
    try:
        dados = base64.b64decode(texto, validate=True)
    except Exception:
        raise ErroPedido(422, f"A máscara da vista {rotulo} não está em base64 válido.") from None
    if not dados.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ErroPedido(422, f"A máscara da vista {rotulo} precisa ser uma imagem PNG.")
    img = cv2.imdecode(np.frombuffer(dados, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ErroPedido(422, f"Não conseguimos abrir a máscara da vista {rotulo}.")
    if img.shape[:2] != esperado:
        raise ErroPedido(
            422,
            f"A máscara da vista {rotulo} ({img.shape[1]}×{img.shape[0]}) não tem o tamanho da "
            f"foto ({esperado[1]}×{esperado[0]}).",
        )
    if not (img > 127).any():
        raise ErroPedido(
            422,
            f"A máscara da vista {rotulo} ficou vazia (toda preta). Pinte a região do tênis.",
        )
    return dados


def regerar_com_mascaras(
    db: Session,
    storage: Storage,
    usuario_id: uuid.UUID,
    modelo_id: uuid.UUID,
    mascaras_b64: dict[str, str],
    resolucao: int = 128,
) -> Job:
    """Cria novo job reaproveitando as fotos do modelo com as máscaras corrigidas (F5-T05)."""
    from relevo_api.servicos.creditos import debitar_credito

    if not mascaras_b64:
        raise ErroPedido(422, "Envie pelo menos uma máscara corrigida para regerar o modelo.")
    try:
        validar_nomes(mascaras_b64)
    except ValueError as e:
        raise ErroPedido(422, str(e)) from None

    modelo = buscar_modelo(db, usuario_id, modelo_id)
    por_vista = {i.vista: i for i in modelo.imagens}
    sem_foto = sorted(set(mascaras_b64) - set(por_vista))
    if sem_foto:
        raise ErroPedido(422, f"Há máscara para vista sem foto: {', '.join(sem_foto)}.")

    # Valida cada máscara antes de criar o job
    pngs_validos = {
        vista: _decodificar_mascara_b64(
            vista, b64, (por_vista[vista].altura_px, por_vista[vista].largura_px)
        )
        for vista, b64 in mascaras_b64.items()
    }

    ultimo_job = max(modelo.jobs, key=lambda j: j.criado_em, default=None)
    ajustes_anteriores = (ultimo_job.parametros or {}).get("ajustes", {}) if ultimo_job else {}

    job = Job(
        modelo_id=modelo.id,
        status="pendente",
        parametros={
            "resolucao": resolucao,
            "faces_alvo": FACES_ALVO,
            "ajustes": ajustes_anteriores,
            "mascaras_corrigidas": {},
        },
    )
    db.add(job)
    db.flush()

    caminhos = {
        vista: storage.salvar(chave_mascara_corrigida(modelo.id, job.id, vista), png)
        for vista, png in pngs_validos.items()
    }
    job.parametros = {**job.parametros, "mascaras_corrigidas": caminhos}
    modelo.status = "processando"
    debitar_credito(db, usuario_id, job.id, motivo="regeracao")
    db.commit()
    db.refresh(job)
    return job


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
        versoes=[
            VersaoResumoOut(
                id=v.id,
                numero=v.numero,
                transformacao=v.transformacao,
                criado_em=v.criado_em,
            )
            for v in modelo.versoes
        ],
        job=job_out(ultimo_job) if ultimo_job else None,
        criado_em=modelo.criado_em,
        atualizado_em=modelo.atualizado_em,
    )


def _versao_out(versao: Versao) -> VersaoOut:
    return VersaoOut(
        id=versao.id,
        numero=versao.numero,
        metricas=versao.metricas,
        transformacao=versao.transformacao,
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


def buscar_modelo_publico(db: Session, modelo_id: uuid.UUID) -> tuple[ModeloPublicoOut, Arquivo]:
    """Busca metadados públicos e o `.glb` ativo de um modelo pronto para incorporação (F5-T06)."""
    modelo = db.get(Modelo, modelo_id)
    if modelo is None or modelo.status != "pronto" or modelo.versao_atual is None:
        raise ErroPedido(404, "Modelo público não encontrado ou ainda não está pronto.")
    versao = next((v for v in modelo.versoes if v.numero == modelo.versao_atual), None)
    if versao is None:
        raise ErroPedido(404, "Versão ativa do modelo não encontrada.")
    glb = next((a for a in versao.arquivos if a.tipo == "glb"), None)
    if glb is None:
        raise ErroPedido(404, "Arquivo 3D do modelo não encontrado.")
    metricas = versao.metricas or {}
    resumo = ModeloPublicoOut(
        id=modelo.id,
        nome=modelo.nome,
        comprimento_cm=float(modelo.comprimento_cm),
        glb_url=f"/publico/{modelo.id}/glb",
        dimensoes_cm=metricas.get("dimensoes_cm"),
        faces=metricas.get("faces"),
        vertices=metricas.get("vertices"),
    )
    return resumo, glb
