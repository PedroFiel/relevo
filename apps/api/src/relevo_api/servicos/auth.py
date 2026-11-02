"""Autenticação por e-mail/senha (`scrypt`) e tokens JWT HS256 (F4-T01)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from relevo_api.config import settings
from relevo_api.models import MovimentoCredito, Usuario
from relevo_api.schemas import LoginIn, RegistroIn, TokenOut
from relevo_api.servicos.creditos import CREDITOS_RECARGA_DEMO, obter_conta
from relevo_api.servicos.modelos import ErroPedido


def _b64url_encode(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _b64url_decode(texto: str) -> bytes:
    resto = len(texto) % 4
    if resto:
        texto += "=" * (4 - resto)
    return base64.urlsafe_b64decode(texto.encode("ascii"))


def gerar_hash_senha(senha: str) -> str:
    """Deriva hash de senha com `scrypt` (stdlib) e sal aleatório de 16 bytes."""
    sal = secrets.token_bytes(16)
    derivado = hashlib.scrypt(senha.encode("utf-8"), salt=sal, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${sal.hex()}${derivado.hex()}"


def verificar_senha(senha: str, senha_hash: str | None) -> bool:
    """Compara senha em tempo constante contra o hash `scrypt$<sal>$<chave>`."""
    if not senha_hash or not senha_hash.startswith("scrypt$"):
        return False
    partes = senha_hash.split("$")
    if len(partes) != 3:
        return False
    try:
        sal = bytes.fromhex(partes[1])
        esperado = bytes.fromhex(partes[2])
    except ValueError:
        return False
    calculado = hashlib.scrypt(
        senha.encode("utf-8"), salt=sal, n=2**14, r=8, p=1, dklen=len(esperado)
    )
    return hmac.compare_digest(calculado, esperado)


def criar_token_jwt(usuario_id: uuid.UUID, expira_em_segundos: int | None = None) -> str:
    """Gera um token JWT HS256 assinado com `settings.jwt_secret`."""
    agora = int(time.time())
    validade = (
        expira_em_segundos
        if expira_em_segundos is not None
        else settings.jwt_validade_horas * 3600
    )
    cabecalho_json = json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode()
    corpo_json = json.dumps(
        {"sub": str(usuario_id), "iat": agora, "exp": agora + validade}, separators=(",", ":")
    ).encode()
    cabecalho = _b64url_encode(cabecalho_json)
    corpo = _b64url_encode(corpo_json)
    mensagem = f"{cabecalho}.{corpo}".encode("ascii")
    assinatura = hmac.new(settings.jwt_secret.encode("utf-8"), mensagem, hashlib.sha256).digest()
    return f"{cabecalho}.{corpo}.{_b64url_encode(assinatura)}"


def decodificar_token_jwt(token: str) -> uuid.UUID:
    """Valida assinatura e expiração de um JWT HS256 e devolve o `UUID` do usuário."""
    partes = token.strip().split(".")
    if len(partes) != 3:
        raise ErroPedido(401, "Token de autenticação inválido.")
    cabecalho_b64, corpo_b64, assinatura_b64 = partes
    mensagem = f"{cabecalho_b64}.{corpo_b64}".encode("ascii")
    esperada = hmac.new(settings.jwt_secret.encode("utf-8"), mensagem, hashlib.sha256).digest()
    try:
        recebida = _b64url_decode(assinatura_b64)
        corpo = json.loads(_b64url_decode(corpo_b64).decode("utf-8"))
    except Exception as erro:
        raise ErroPedido(401, "Token de autenticação malformado.") from erro

    if not hmac.compare_digest(esperada, recebida):
        raise ErroPedido(401, "Assinatura do token inválida.")
    if int(corpo.get("exp", 0)) < int(time.time()):
        raise ErroPedido(401, "Sua sessão expirou. Entre novamente.")
    try:
        return uuid.UUID(str(corpo["sub"]))
    except (KeyError, ValueError) as erro:
        raise ErroPedido(401, "Identificador de usuário inválido no token.") from erro


def registrar_usuario(db: Session, entrada: RegistroIn) -> TokenOut:
    """Cria uma nova conta com 10 créditos iniciais de boas-vindas e devolve o JWT (F4-T01)."""
    nome = entrada.nome.strip()
    email = entrada.email.strip().lower()
    if len(nome) < 2:
        raise ErroPedido(400, "Informe seu nome (pelo menos 2 caracteres).")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ErroPedido(400, "Informe um e-mail válido.")
    if len(entrada.senha) < 6:
        raise ErroPedido(400, "A senha precisa ter pelo menos 6 caracteres.")

    existente = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    if existente is not None:
        raise ErroPedido(409, "Já existe uma conta cadastrada com este e-mail.")

    usuario = Usuario(
        id=uuid.uuid4(),
        nome=nome,
        email=email,
        senha_hash=gerar_hash_senha(entrada.senha),
        creditos=CREDITOS_RECARGA_DEMO,
    )
    db.add(usuario)
    db.flush()
    db.add(
        MovimentoCredito(
            usuario_id=usuario.id,
            quantidade=CREDITOS_RECARGA_DEMO,
            motivo="boas-vindas",
            criado_em=datetime.now(UTC),
        )
    )
    db.commit()
    return TokenOut(
        access_token=criar_token_jwt(usuario.id),
        usuario=obter_conta(db, usuario.id),
    )


def autenticar_usuario(db: Session, entrada: LoginIn) -> TokenOut:
    """Valida e-mail e senha e devolve o JWT da sessão (F4-T01)."""
    email = entrada.email.strip().lower()
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    if usuario is None or not verificar_senha(entrada.senha, usuario.senha_hash):
        raise ErroPedido(401, "E-mail ou senha incorretos.")
    return TokenOut(
        access_token=criar_token_jwt(usuario.id),
        usuario=obter_conta(db, usuario.id),
    )
