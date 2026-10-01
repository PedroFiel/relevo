# Atalhos do RELEVO. Rode `make help` para ver tudo.
.PHONY: help setup db-up db-down migrate api web test test-py test-web lint poc real

help:  ## lista os comandos
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

setup:  ## instala tudo (Python via uv + Node via npm) e cria o .env
	uv sync --all-packages
	cd apps/web && npm install
	@test -f .env || cp .env.example .env

db-up:  ## sobe PostgreSQL (5432) e Adminer (8080) no Docker
	docker compose up -d

db-down:  ## derruba os containers (os dados ficam no volume)
	docker compose down

migrate:  ## aplica as migrações do banco
	cd apps/api && uv run alembic upgrade head

api:  ## roda a API em http://localhost:8000 (docs em /docs)
	uv run uvicorn relevo_api.main:app --reload --port 8000

web:  ## roda o front em http://localhost:5173
	cd apps/web && npm run dev

test: test-py test-web  ## roda todos os testes

test-py:  ## testes do pipeline e da API
	uv run pytest -q

test-web:  ## testes do front
	cd apps/web && npm test

lint:  ## lint Python (ruff) e front (oxlint)
	uv run ruff check .
	cd apps/web && npm run lint

poc:  ## gera fotos sintéticas e roda o pipeline ponta a ponta
	uv run relevo-pipeline sintetico --pasta samples/sintetico
	uv run relevo-pipeline gerar --lateral samples/sintetico/lateral.png \
		--topo samples/sintetico/topo.png --frente samples/sintetico/frente.png \
		--comprimento-cm 28 --saida apps/web/public/samples/tenis-exemplo.glb --debug out/debug

CM ?= 30
real:  ## gera o modelo colorido do tenis-01 (fotos em samples/reais) -> /visualizador. Use CM=28.5 p/ a medida real
	uv run relevo-pipeline gerar --lateral samples/reais/tenis-01/lateral.jpg \
		--topo samples/reais/tenis-01/topo.jpg --frente samples/reais/tenis-01/frente.jpg \
		--comprimento-cm $(CM) --resolucao 256 --saida apps/web/public/samples/tenis-01.glb --debug out/tenis-01
