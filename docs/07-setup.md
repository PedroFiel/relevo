# 07 — Setup do ambiente (passo a passo)

Tempo estimado: 20–30 min na primeira vez. Se algo falhar, anote no diário e peça ajuda no grupo.

## 1. Instalar as ferramentas

| Ferramenta | Para quê | Windows | macOS | Linux (Ubuntu) |
|---|---|---|---|---|
| Git | versionamento | [git-scm.com](https://git-scm.com/download/win) | `xcode-select --install` | `sudo apt install git` |
| Python 3.11+ | pipeline e API | o **uv** instala sozinho (passo 2) | idem | idem |
| uv | gerencia Python e pacotes | `powershell -c "irm https://astral.sh/uv/install.ps1 \| iex"` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | idem macOS |
| Node.js 22 LTS | front-end | [nodejs.org](https://nodejs.org) | `brew install node@22` | via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22` |
| Docker Desktop | PostgreSQL | [docker.com](https://www.docker.com/products/docker-desktop/) (ativar WSL 2) | Docker Desktop | `sudo apt install docker.io docker-compose-v2` |
| make (opcional) | atalhos | use os comandos do Makefile manualmente ou `choco install make` | já vem | já vem |
| VS Code (sugerido) | editor | extensões: Python, Ruff, ESLint, Prettier, Mermaid Preview | | |

Conferir:
```bash
git --version && uv --version && node -v && docker --version
```

## 2. Clonar e instalar

```bash
git clone <url-do-repo> relevo && cd relevo
uv python install 3.11          # só se não tiver Python 3.11+
uv sync --all-packages          # cria .venv e instala pipeline + API + ferramentas
cd apps/web && npm install && cd ../..
cp .env.example .env            # Windows: copy .env.example .env
```

## 3. Banco de dados

```bash
docker compose up -d            # PostgreSQL em localhost:5432, Adminer em http://localhost:8080
cd apps/api && uv run alembic upgrade head && cd ../..
```
Adminer: sistema *PostgreSQL*, servidor `postgres`, usuário `relevo`, senha `relevo`, base `relevo`.

**Sem Docker?** Instale o PostgreSQL 16 nativo e rode:
```sql
CREATE ROLE relevo LOGIN PASSWORD 'relevo' CREATEDB;
CREATE DATABASE relevo OWNER relevo;
```

## 4. Validar que está tudo certo

```bash
uv run pytest -q                                # deve passar tudo
make poc                                        # gera samples/sintetico + tenis-exemplo.glb
uv run uvicorn relevo_api.main:app --reload     # abra http://localhost:8000/docs  e  /health/db
cd apps/web && npm run dev                      # abra http://localhost:5173/visualizador
```

Você deve ver um "tênis" cinza girando com o mouse, e os botões Sólido / Wireframe / Normais funcionando.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `ModuleNotFoundError: relevo_api` | pacote do workspace não instalado | `uv sync --all-packages --reinstall-package relevo-api` |
| `/health/db` → `indisponivel` | Postgres parado ou `.env` errado | `docker compose ps`; confira `DATABASE_URL` |
| porta 5432 ocupada | outro Postgres rodando | pare o outro ou mude a porta no `docker-compose.yml` e no `.env` |
| tela preta no visualizador | GPU/WebGL desativado | testar em <https://get.webgl.org>; ativar aceleração de hardware no navegador |
| `npm ERR! engine` | Node antigo | instalar Node 22 |
