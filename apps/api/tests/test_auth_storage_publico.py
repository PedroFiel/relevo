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
