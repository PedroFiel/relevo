"""Onde ficam as fotos enviadas e os arquivos gerados (`.glb`, intermediários).

O resto da API só conhece a interface `Storage` e fala em **chaves** (caminhos relativos com `/`,
gravados em `imagens.caminho` e `arquivos.caminho`). No MVP a implementação é o disco local
(`LocalStorage`); na Fase 4 entra o `S3Storage` com a mesma interface (F4-T08, decisão D9).

Chaves usadas:
    modelos/{modelo_id}/fotos/{vista}.{ext}
    modelos/{modelo_id}/v{n}/modelo.glb
    modelos/{modelo_id}/v{n}/etapas/...
"""

from __future__ import annotations

import hashlib
import hmac
import io
import os
import re
import shutil
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID

from relevo_api.config import settings

# Cada pedaço da chave: letras, números, `_`, `-` e `.`; nada de `..`, barra invertida ou espaço.
PEDACO_VALIDO = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]*$")


class ChaveInvalida(ValueError):
    """Chave com `..`, barra no começo, pedaço vazio ou caractere fora do permitido."""


def validar_chave(chave: str) -> str:
    """Devolve a chave se for segura; senão levanta `ChaveInvalida` (contra *path traversal*)."""
    pedacos = chave.split("/")
    if not chave or any(not PEDACO_VALIDO.match(p) or p in (".", "..") for p in pedacos):
        raise ChaveInvalida(f"chave de arquivo inválida: {chave!r}")
    return chave


def chave_foto(modelo_id: UUID, vista: str, ext: str) -> str:
    return validar_chave(f"modelos/{modelo_id}/fotos/{vista}.{ext}")


def chave_glb(modelo_id: UUID, numero_versao: int) -> str:
    return validar_chave(f"modelos/{modelo_id}/v{numero_versao}/modelo.glb")


def chave_exportado(modelo_id: UUID, numero_versao: int, formato: str) -> str:
    """Arquivo exportado sob demanda (.glb, .obj, .stl) de uma versão (F4-T05)."""
    return validar_chave(f"modelos/{modelo_id}/v{numero_versao}/modelo.{formato}")


def chave_etapa(modelo_id: UUID, numero_versao: int, nome: str) -> str:
    """Intermediário do Raio-X (máscara, voxels, malha bruta) de uma versão."""
    return validar_chave(f"modelos/{modelo_id}/v{numero_versao}/etapas/{nome}")


def chave_mascara_corrigida(modelo_id: UUID, job_id: UUID, vista: str) -> str:
    """Máscara PNG desenhada pelo pincel de correção (F5-T05)."""
    return validar_chave(f"modelos/{modelo_id}/jobs/{job_id}/mascara-{vista}.png")


def prefixo_modelo(modelo_id: UUID) -> str:
    return validar_chave(f"modelos/{modelo_id}")


class Storage(Protocol):
    def salvar(self, chave: str, dados: bytes) -> str:
        """Grava (ou substitui) o arquivo e devolve a chave."""
        ...

    def abrir(self, chave: str) -> bytes:
        """Lê o arquivo inteiro; `FileNotFoundError` se não existir."""
        ...

    def caminho_local(self, chave: str) -> Path:
        """Caminho no disco (para `FileResponse` e para o pipeline ler/gravar)."""
        ...

    def apagar_prefixo(self, prefixo: str) -> None:
        """Apaga tudo sob o prefixo (ex.: um modelo inteiro). Prefixo inexistente não é erro."""
        ...


class LocalStorage:
    """Storage em uma pasta do disco (`STORAGE_DIR`, padrão `storage/` na raiz do repo)."""

    def __init__(self, raiz: Path) -> None:
        self.raiz = Path(raiz).resolve()

    def caminho_local(self, chave: str) -> Path:
        caminho = (self.raiz / validar_chave(chave)).resolve()
        # Segunda barreira: mesmo com link simbólico no meio, nada sai da raiz
        if not caminho.is_relative_to(self.raiz):
            raise ChaveInvalida(f"chave de arquivo inválida: {chave!r}")
        return caminho

    def salvar(self, chave: str, dados: bytes) -> str:
        destino = self.caminho_local(chave)
        destino.parent.mkdir(parents=True, exist_ok=True)
        # Grava num temporário e troca de uma vez: quem lê nunca vê arquivo pela metade
        fd, temporario = tempfile.mkstemp(dir=destino.parent, prefix=".tmp-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(dados)
            os.replace(temporario, destino)
        except BaseException:
            Path(temporario).unlink(missing_ok=True)
            raise
        return chave

    def abrir(self, chave: str) -> bytes:
        return self.caminho_local(chave).read_bytes()

    def apagar_prefixo(self, prefixo: str) -> None:
        alvo = self.caminho_local(prefixo)
        if alvo.is_dir():
            shutil.rmtree(alvo)
        else:
            alvo.unlink(missing_ok=True)


class _ClienteS3Http:
    """Cliente HTTP S3/MinIO leve (AWS Signature V4) usando apenas a biblioteca padrão."""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region: str = "us-east-1",
    ) -> None:
        self.endpoint_url = endpoint_url.rstrip("/")
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self._buckets_garantidos: set[str] = set()

    def _assinar_e_enviar(
        self,
        metodo: str,
        caminho: str,
        query: dict[str, str] | None = None,
        corpo: bytes = b"",
    ) -> bytes:
        parsed = urllib.parse.urlparse(self.endpoint_url)
        host = parsed.netloc
        uri_base = parsed.path.rstrip("/")
        uri_canonica = f"{uri_base}/{caminho.lstrip('/')}"
        qs_itens = sorted((query or {}).items())
        qs_canonica = "&".join(
            f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
            for k, v in qs_itens
        )

        agora = datetime.now(UTC)
        amz_date = agora.strftime("%Y%m%dT%H%M%SZ")
        datestamp = agora.strftime("%Y%m%d")
        payload_hash = hashlib.sha256(corpo).hexdigest()

        cabecalhos_canonicos = (
            f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
        )
        assinados = "host;x-amz-content-sha256;x-amz-date"
        requisicao_canonica = "\n".join(
            [metodo, uri_canonica, qs_canonica, cabecalhos_canonicos, assinados, payload_hash]
        )

        escopo = f"{datestamp}/{self.region}/s3/aws4_request"
        string_assinatura = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                escopo,
                hashlib.sha256(requisicao_canonica.encode("utf-8")).hexdigest(),
            ]
        )

        def _hmac(chave: bytes, msg: str) -> bytes:
            return hmac.new(chave, msg.encode("utf-8"), hashlib.sha256).digest()

        k_date = _hmac(f"AWS4{self.secret_key}".encode(), datestamp)
        k_region = _hmac(k_date, self.region)
        k_service = _hmac(k_region, "s3")
        k_signing = _hmac(k_service, "aws4_request")
        assinatura = hmac.new(
            k_signing, string_assinatura.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        autorizacao = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{escopo}, "
            f"SignedHeaders={assinados}, Signature={assinatura}"
        )
        url = f"{self.endpoint_url}/{caminho.lstrip('/')}"
        if qs_canonica:
            url = f"{url}?{qs_canonica}"

        req = urllib.request.Request(
            url,
            data=corpo if metodo in ("PUT", "POST") else None,
            method=metodo,
            headers={
                "Host": host,
                "x-amz-date": amz_date,
                "x-amz-content-sha256": payload_hash,
                "Authorization": autorizacao,
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
            return resp.read()

    def _garantir_bucket(self, bucket: str) -> None:
        if bucket in self._buckets_garantidos:
            return
        try:
            self._assinar_e_enviar("PUT", bucket)
        except urllib.error.HTTPError as e:
            if e.code not in (200, 409):
                raise
        self._buckets_garantidos.add(bucket)

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
        self._garantir_bucket(Bucket)
        self._assinar_e_enviar("PUT", f"{Bucket}/{Key}", corpo=bytes(Body))

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:
        dados = self._assinar_e_enviar("GET", f"{Bucket}/{Key}")
        return {"Body": io.BytesIO(dados)}

    def list_objects_v2(self, *, Bucket: str, Prefix: str) -> dict[str, Any]:
        try:
            xml_bytes = self._assinar_e_enviar(
                "GET", Bucket, query={"list-type": "2", "prefix": Prefix}
            )
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
            raise
        raiz = ET.fromstring(xml_bytes)  # noqa: S314
        achados: list[dict[str, str]] = []
        for elem in raiz.iter():
            if elem.tag.endswith("Key") and elem.text:
                achados.append({"Key": elem.text})
        return {"Contents": achados} if achados else {}

    def delete_objects(self, *, Bucket: str, Delete: dict[str, Any]) -> None:
        for item in Delete.get("Objects", []):
            chave = item.get("Key")
            if not chave:
                continue
            try:
                self._assinar_e_enviar("DELETE", f"{Bucket}/{chave}")
            except urllib.error.HTTPError as e:
                if e.code != 404:
                    raise


class S3Storage:
    """Storage compatível com S3 / MinIO / Cloudflare R2 (F4-T08, decisão D9).

    Guarda os objetos no bucket S3 e mantém um cache local em disco para que `caminho_local`
    continue servindo `FileResponse` e o pipeline sem mudar nenhuma linha dos serviços.
    """

    def __init__(
        self,
        bucket: str,
        cache_dir: Path,
        cliente: object | None = None,
    ) -> None:
        self.bucket = bucket
        self._cache = LocalStorage(cache_dir)
        if cliente is None:
            cliente = _ClienteS3Http(
                endpoint_url=settings.s3_endpoint_url,
                access_key=settings.s3_access_key,
                secret_key=settings.s3_secret_key,
                region=settings.s3_region,
            )
        self.cliente: Any = cliente

    def salvar(self, chave: str, dados: bytes) -> str:
        chave_limpa = validar_chave(chave)
        self.cliente.put_object(Bucket=self.bucket, Key=chave_limpa, Body=dados)
        self._cache.salvar(chave_limpa, dados)
        return chave_limpa

    def abrir(self, chave: str) -> bytes:
        chave_limpa = validar_chave(chave)
        try:
            resposta = self.cliente.get_object(Bucket=self.bucket, Key=chave_limpa)
        except Exception as erro:
            raise FileNotFoundError(chave_limpa) from erro
        corpo = resposta["Body"]
        dados = corpo.read() if hasattr(corpo, "read") else bytes(corpo)
        self._cache.salvar(chave_limpa, dados)
        return dados

    def caminho_local(self, chave: str) -> Path:
        chave_limpa = validar_chave(chave)
        caminho = self._cache.caminho_local(chave_limpa)
        if not caminho.is_file():
            try:
                self.abrir(chave_limpa)
            except FileNotFoundError:
                pass
        return caminho

    def apagar_prefixo(self, prefixo: str) -> None:
        prefixo_limpo = validar_chave(prefixo)
        listagem = self.cliente.list_objects_v2(Bucket=self.bucket, Prefix=prefixo_limpo)
        objetos = [{"Key": obj["Key"]} for obj in listagem.get("Contents", [])]
        if objetos:
            self.cliente.delete_objects(Bucket=self.bucket, Delete={"Objects": objetos})
        self._cache.apagar_prefixo(prefixo_limpo)


@lru_cache
def get_storage() -> Storage:
    """Dependência do FastAPI; nos testes é trocada por um `LocalStorage(tmp_path)` (F3-T04)."""
    if settings.storage_tipo.lower() == "s3":
        return S3Storage(settings.s3_bucket, settings.storage_dir / ".s3-cache")
    return LocalStorage(settings.storage_dir)
