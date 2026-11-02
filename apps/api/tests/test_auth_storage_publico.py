"""Testes de autenticação JWT (F4-T01), S3Storage (F4-T08) e rota pública de embed (F5-T06)."""

from __future__ import annotations

import io
from pathlib import Path

import cv2
import pytest
from relevo_api.servicos.auth import criar_token_jwt
from relevo_api.storage import ChaveInvalida, S3Storage
from relevo_pipeline.sintetico import gerar_fotos


@pytest.fixture(scope="module")
def fotos_png() -> dict[str, bytes]:
    return {v: cv2.imencode(".png", img)[1].tobytes() for v, img in gerar_fotos().items()}


# ---------- Autenticação JWT e isolamento por usuário (F4-T01) ----------
def test_registro_login_e_isolamento_entre_usuarios(cliente, fotos_png):
    reg_a = cliente.post(
        "/auth/registrar",
        json={"nome": "Alice", "email": "alice@relevo.dev", "senha": "senha-segura-123"},
    )
    assert reg_a.status_code == 201, reg_a.text
    corpo_a = reg_a.json()
    token_a = corpo_a["access_token"]
    assert corpo_a["usuario"]["email"] == "alice@relevo.dev"
    assert corpo_a["usuario"]["creditos"] == 10
    assert corpo_a["usuario"]["movimentos"][0]["motivo"] == "boas-vindas"

    # E-mail duplicado -> 409
    dup = cliente.post(
        "/auth/registrar",
        json={"nome": "Outra", "email": "ALICE@relevo.dev", "senha": "senha-segura-123"},
    )
    assert dup.status_code == 409

    # Login com senha errada -> 401
    errado = cliente.post(
        "/auth/login",
        json={"email": "alice@relevo.dev", "senha": "errada"},
    )
    assert errado.status_code == 401

    # Login válido -> 200
    login_a = cliente.post(
        "/auth/login",
        json={"email": "alice@relevo.dev", "senha": "senha-segura-123"},
    )
    assert login_a.status_code == 200
    assert login_a.json()["usuario"]["id"] == corpo_a["usuario"]["id"]

    # Alice cria um modelo com seu token
    arquivos = {v: (f"{v}.png", io.BytesIO(b), "image/png") for v, b in fotos_png.items()}
    criado_a = cliente.post(
        "/modelos",
        data={"nome": "Tênis da Alice", "comprimento_cm": "28", "resolucao": "64"},
        files=arquivos,
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert criado_a.status_code == 202
    modelo_id_a = criado_a.json()["modelo_id"]

    # Bob se cadastra e NÃO pode ver nem apagar o modelo da Alice (404)
    reg_b = cliente.post(
        "/auth/registrar",
        json={"nome": "Bob", "email": "bob@relevo.dev", "senha": "senha-segura-456"},
    )
    assert reg_b.status_code == 201
    token_b = reg_b.json()["access_token"]

    lista_b = cliente.get("/modelos", headers={"Authorization": f"Bearer {token_b}"})
    assert lista_b.status_code == 200
    assert lista_b.json() == []

    detalhe_b = cliente.get(
        f"/modelos/{modelo_id_a}", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert detalhe_b.status_code == 404

    delete_b = cliente.delete(
        f"/modelos/{modelo_id_a}", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert delete_b.status_code == 404

    # Mas a rota pública /publico/{id} serve o embed sem exigir token (F5-T06)
    pub = cliente.get(f"/publico/{modelo_id_a}")
    assert pub.status_code == 200
    dados_pub = pub.json()
    assert dados_pub["nome"] == "Tênis da Alice"
    assert dados_pub["glb_url"] == f"/publico/{modelo_id_a}/glb"
    assert dados_pub["faces"] > 0

    glb_pub = cliente.get(dados_pub["glb_url"])
    assert glb_pub.status_code == 200
    assert glb_pub.content[:4] == b"glTF"


def test_token_expirado_ou_invalido_retorna_401(cliente):
    import uuid

    expirado = criar_token_jwt(uuid.uuid4(), expira_em_segundos=-10)
    r1 = cliente.get("/me", headers={"Authorization": f"Bearer {expirado}"})
    assert r1.status_code == 401

    r2 = cliente.get("/me", headers={"Authorization": "Bearer token.adulterado.invalido"})
    assert r2.status_code == 401


# ---------- S3Storage (F4-T08) ----------
class _ClienteS3Memoria:
    """Cliente compatível com a interface `boto3` S3 em memória para testar `S3Storage`."""

    def __init__(self) -> None:
        self.objetos: dict[tuple[str, str], bytes] = {}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
        self.objetos[(Bucket, Key)] = bytes(Body)

    def get_object(self, *, Bucket: str, Key: str) -> dict:
        if (Bucket, Key) not in self.objetos:
            raise KeyError(Key)
        return {"Body": io.BytesIO(self.objetos[(Bucket, Key)])}

    def list_objects_v2(self, *, Bucket: str, Prefix: str) -> dict:
        achados = [
            {"Key": k} for (b, k) in self.objetos if b == Bucket and k.startswith(Prefix)
        ]
        return {"Contents": achados} if achados else {}

    def delete_objects(self, *, Bucket: str, Delete: dict) -> None:
        for item in Delete.get("Objects", []):
            self.objetos.pop((Bucket, item["Key"]), None)


def test_s3_storage_salvar_abrir_cache_local_e_apagar_prefixo(tmp_path: Path):
    cliente_s3 = _ClienteS3Memoria()
    s3 = S3Storage(bucket="relevo-test", cache_dir=tmp_path / "cache", cliente=cliente_s3)

    chave = "modelos/123/v1/modelo.glb"
    s3.salvar(chave, b"glTF-conteudo")
    assert s3.abrir(chave) == b"glTF-conteudo"

    # Se o cache local for limpo (ex.: outro container), `caminho_local` baixa do S3 sob demanda
    caminho = s3.caminho_local(chave)
    caminho.unlink()
    assert not caminho.exists()
    caminho_recuperado = s3.caminho_local(chave)
    assert caminho_recuperado.read_bytes() == b"glTF-conteudo"

    # Apagar prefixo remove tanto do bucket quanto do cache local
    s3.apagar_prefixo("modelos/123")
    with pytest.raises(FileNotFoundError):
        s3.abrir(chave)

    # Proteção contra path traversal
    with pytest.raises(ChaveInvalida):
        s3.salvar("../fora/segredo.txt", b"x")


def test_s3_storage_cliente_http_padrao_aws_sigv4(tmp_path: Path):
    """Testa `S3Storage(..., cliente=None)` usando o cliente HTTP AWS SigV4 nativo (sem boto3)."""
    import urllib.parse
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from threading import Thread

    armazenamento: dict[str, bytes] = {}
    cabecalhos_auth: list[str] = []

    class _ServidorS3Falso(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:  # noqa: A002
            pass

        def _registrar_auth(self) -> None:
            cabecalhos_auth.append(self.headers.get("Authorization", ""))

        def do_PUT(self) -> None:
            self._registrar_auth()
            tamanho = int(self.headers.get("Content-Length", "0"))
            corpo = self.rfile.read(tamanho) if tamanho > 0 else b""
            partes = self.path.lstrip("/").split("/", 1)
            if len(partes) == 2:
                armazenamento[partes[1]] = corpo
            self.send_response(200)
            self.end_headers()

        def do_GET(self) -> None:
            self._registrar_auth()
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            partes = parsed.path.lstrip("/").split("/", 1)
            if len(partes) == 1 and "list-type" in qs:
                prefixo = qs.get("prefix", [""])[0]
                chaves = [k for k in armazenamento if k.startswith(prefixo)]
                itens = "".join(f"<Contents><Key>{k}</Key></Contents>" for k in chaves)
                xml = (
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    f"<ListBucketResult>{itens}</ListBucketResult>"
                )
                dados = xml.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/xml")
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)
                return
            if len(partes) == 2 and partes[1] in armazenamento:
                dados = armazenamento[partes[1]]
                self.send_response(200)
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)
                return
            self.send_response(404)
            self.end_headers()

        def do_DELETE(self) -> None:
            self._registrar_auth()
            partes = self.path.lstrip("/").split("/", 1)
            if len(partes) == 2:
                armazenamento.pop(partes[1], None)
            self.send_response(204)
            self.end_headers()

    servidor = HTTPServer(("127.0.0.1", 0), _ServidorS3Falso)
    porta = servidor.server_port
    t = Thread(target=servidor.serve_forever, daemon=True)
    t.start()
    try:
        from relevo_api.config import settings

        endpoint_antigo = settings.s3_endpoint_url
        settings.s3_endpoint_url = f"http://127.0.0.1:{porta}"
        try:
            s3 = S3Storage(bucket="relevo-http", cache_dir=tmp_path / "cache-http", cliente=None)
            chave = "modelos/abc/v1/modelo.glb"
            s3.salvar(chave, b"glTF-via-http-sigv4")
            assert any(h.startswith("AWS4-HMAC-SHA256 Credential=") for h in cabecalhos_auth)

            # Força leitura pela rede apagando o cache local
            s3.caminho_local(chave).unlink()
            assert s3.abrir(chave) == b"glTF-via-http-sigv4"

            s3.apagar_prefixo("modelos/abc")
            with pytest.raises(FileNotFoundError):
                s3.abrir(chave)
        finally:
            settings.s3_endpoint_url = endpoint_antigo
    finally:
        servidor.shutdown()
        servidor.server_close()
