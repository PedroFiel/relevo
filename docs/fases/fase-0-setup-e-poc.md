# Fase 0 — Setup e prova de conceito

**Objetivo:** sair do zero. Repositório organizado, as 3 stacks instaladas e conversando, e a prova de que
**3 fotos viram um objeto 3D reconhecível** antes de investir em telas.

**Por que primeiro:** o maior risco do projeto é o algoritmo não funcionar com fotos reais. Esta fase elimina
esse risco cedo.

**Status:** a parte técnica (T01–T07) foi feita na sessão de 30/09/2026. Falta o grupo executar T08–T10.

---

### F0-T01 — Estrutura do monorepo
- **Frente:** todas
- **Como fazer:** `apps/web`, `apps/api`, `packages/pipeline`, `docs/`, `samples/`; `Makefile`, `.gitignore`,
  `.env.example`, `docker-compose.yml`, `CLAUDE.md`.
- **Aceite:** `make help` lista os comandos; a árvore bate com o README.

### F0-T02 — Workspace Python com uv
- **Frente:** pipeline, back
- **Como fazer:** `pyproject.toml` raiz como *workspace* virtual com membros `packages/pipeline` e `apps/api`;
  a API depende do pipeline via `{ workspace = true }`; grupo `dev` com pytest, ruff, httpx, jupyter.
- **Aceite:** `uv sync --all-packages` instala tudo; `uv run python -c "import relevo_api, relevo_pipeline"` funciona.

### F0-T03 — Pipeline mínimo (segmentação → alinhamento → visual hull → Marching Cubes → exportação)
- **Frente:** pipeline
- **Como fazer:** módulos `segmentacao.py`, `alinhamento.py`, `voxel.py`, `malha.py`, `exportar.py`, orquestrados
  por `pipeline.processar()`; CLI `relevo-pipeline` com subcomandos `sintetico` e `gerar` (`--debug` salva intermediários).
- **Testes:** `packages/pipeline/tests/test_pipeline.py` — segmentação (fundo claro/escuro, buracos), alinhamento
  (dimensões), visual hull (caixa cheia; **hull ⊇ objeto**), ponta a ponta (malha fechada, 28 cm ± 1).
- **Aceite:** `make poc` gera `tenis-exemplo.glb` com malha fechada e comprimento 28 cm.
- **Conceito de CG:** limiarização de Otsu, morfologia, projeção ortográfica, voxels, visual hull, Marching Cubes.

### F0-T04 — Gerador de fotos sintéticas
- **Frente:** pipeline
- **Como fazer:** `sintetico.py` define um "tênis" como função implícita 3D e renderiza as 3 projeções ortográficas
  com escalas/margens diferentes e ruído — exercita o alinhamento sem precisar de câmera.
- **Aceite:** `uv run relevo-pipeline sintetico` cria `samples/sintetico/{lateral,topo,frente}.png`.

### F0-T05 — API FastAPI esqueleto
- **Frente:** back, banco
- **Como fazer:** `config.py` (pydantic-settings lendo `.env`), `db.py` (engine SQLAlchemy, `Base`, `get_db`),
  `main.py` com CORS, `/health` e `/health/db`; Alembic inicializado com migração *baseline*.
- **Testes:** `apps/api/tests/test_health.py`.
- **Aceite:** `make api` → `http://localhost:8000/docs` abre; `/health/db` responde `ok` com o banco no ar.

### F0-T06 — PostgreSQL via Docker
- **Frente:** banco
- **Como fazer:** `docker-compose.yml` com `postgres:16-alpine` (usuário/senha/base `relevo`) + Adminer na 8080.
- **Aceite:** `make db-up && make migrate` sem erro; tabela `alembic_version` visível no Adminer.

### F0-T07 — Front React + Three.js esqueleto
- **Frente:** front
- **Como fazer:** Vite `react-ts`; three, @react-three/fiber, drei, react-router, TanStack Query; páginas `/` e
  `/visualizador`; `ModelViewer` carrega o `.glb` de exemplo com OrbitControls e modos sólido/wireframe/normais;
  Vitest + Testing Library; proxy `/api` → `:8000`.
- **Testes:** `src/App.test.tsx`.
- **Aceite:** `make web` → `/visualizador` mostra o tênis sintético; os 3 modos funcionam.
- **Conceito de CG:** câmera perspectiva, iluminação (hemisférica + direcional), materiais PBR, wireframe, normais.

### F0-T08 — Subir para o repositório do grupo e CI
- **Frente:** todas · **Responsável:** quem administra o repo
- **Como fazer:**
  1. Copiar o conteúdo do pacote para o repo do grupo (ou `git remote add origin <url>` e `git push -u origin main`).
  2. Conferir que o GitHub Actions (`.github/workflows/ci.yml`) rodou verde.
  3. Proteger a branch `main`: exigir PR + CI verde + 1 aprovação.
- **Aceite:** badge/aba *Actions* verde no último commit da `main`.

### F0-T09 — Cada integrante roda o setup
- **Frente:** todas · **Responsável:** cada integrante
- **Como fazer:** seguir [07-setup.md](../07-setup.md). Anotar problemas no diário.
- **Aceite:** cada pessoa consegue rodar `make test` e ver o `/visualizador` na própria máquina.

### F0-T10 — Prova com fotos reais (a mais importante da fase)
- **Frente:** pipeline · **Responsável:** 1–2 pessoas
- **Como fazer:**
  1. Escolher 2 tênis: um **escuro** e um **claro**. Fotografar seguindo o [guia de fotos](../06-guia-de-fotos.md).
     Reduzir as fotos para ~1600 px no lado maior antes de commitar.
  2. Salvar em `samples/reais/tenis-01/{lateral,topo,frente}.jpg` (e `tenis-02`), com um `info.md` contendo a
     medida real com fita métrica (comprimento, largura, altura em cm).
  3. Rodar:
     ```bash
     uv run relevo-pipeline gerar --lateral samples/reais/tenis-01/lateral.jpg \
       --topo samples/reais/tenis-01/topo.jpg --frente samples/reais/tenis-01/frente.jpg \
       --comprimento-cm <medida> --saida out/tenis-01.glb --debug out/tenis-01
     ```
  4. Abrir as máscaras em `out/tenis-01/1_mascara_*.png`: o tênis está branco e o fundo preto, sem buracos?
  5. Abrir o `.glb` em <https://gltf-viewer.donmccurdy.com/> (arrastar o arquivo) ou no `/visualizador` (copiando para
     `apps/web/public/samples/`).
  6. Registrar em `docs/testes/relatorios/AAAA-MM-DD-fotos-reais-f0.md` (template na mesma pasta): máscaras OK?
     reconhecível? erro dimensional? problemas encontrados?
- **Aceite:** pelo menos 1 tênis real gera modelo reconhecível; problemas viram tarefas na Fase 1.

## Encerramento da Fase 0

- [ ] T08–T10 concluídas
- [ ] Revisão de fase em `docs/revisoes/fase-0.md` (usar `docs/revisoes/TEMPLATE-fase.md`) com prints do resultado real
- [ ] Distribuição de pessoas para as Fases 1 (pipeline) e 2 (front) registrada no STATUS
