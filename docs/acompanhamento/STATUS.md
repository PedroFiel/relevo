# STATUS — Painel do projeto

> Atualize este arquivo **no fim de toda sessão de trabalho**. É a primeira coisa que o Claude lê.

**Fase atual:** 3 — Integração (MVP). Das Fases 0–2 ficaram pendências que não travam a 3 (ver as tabelas).
**Próxima tarefa:** MVP na `main` (PR #10) + Raio-X pronto (F5-T01) → **grupo:** F0-T10 (foto própria + fita métrica), slides e ensaio a partir de `docs/apresentacao/roteiro.md`, vídeo da demo; tag `v0.1.0-mvp` (ver [Plano de finalização](#plano-de-finalização))
**Data de entrega:** _a definir_ · **Última atualização:** 28/10/2026

Legenda: `a fazer` · `em andamento` · `feito` · `bloqueado`

## Equipe

| Pessoa | Frente principal | Contato |
|---|---|---|
| Pedro | _a definir_ | |
| _integrante 2_ | | |
| _integrante 3_ | | |

Divisão sugerida: 1 pessoa na **trilha A** (back + banco + pipeline), 1–2 na **trilha B** (front); no fechamento todos
convergem.

## Plano de finalização

Definido em 27/10/2026. Meta: o fluxo ideal de ponta a ponta — subir as fotos (ajustando recorte/rotação) →
acompanhar as etapas → ver o tênis 3D com as ferramentas de CG → baixar → achar em "Meus modelos" —, com o front
bonito e funcionando em 375 px. As duas trilhas andam **em paralelo** e se encontram no passo 4 da trilha B.

**Trilha A — back, banco e pipeline**

| # | Tarefa | Por quê / observação |
|---|---|---|
| 1 | F3-T01 — tabelas e migração | **feito** (PR #4) |
| 2 | F3-T02 — Storage local | **feito** (28/10, PR #6) — onde ficam fotos e `.glb`; base do upload |
| 3 | F3-T04 — terminar: `get_db` e Storage trocados nos testes de rota | **feito** (28/10, PR #7) — fixture `cliente` |
| 4 | F1-T08 — **só o callback** `ao_progredir(etapa, %)` | **feito** (28/10, PR #7) — é o que a F3-T05 usa; os intermediários vieram depois, com a F5-T01 |
| 5 | F3-T03 — `POST /modelos` (upload + `ajustes`) | **feito** (28/10) — valida pelos bytes; 202 com `modelo_id`/`job_id` |
| 6 | F3-T05 — execução do job | **feito** (28/10) — etapa e progresso no banco; erro amigável |
| 7 | F3-T06 — leitura, download e delete | **feito** (28/10) — a partir daqui o front sai do *mock* (testado contra o Neon) |
| 8 | F1-T03 — decimação (~20 mil faces) | **feito** (28/10) — tenis-01: 6,6 MB → 0,52 MB, erro médio 0,07 mm; rode `make reais` para regerar os locais |

**Trilha B — front (bonito, responsivo e funcional)**

| # | Tarefa | Por quê / observação |
|---|---|---|
| 1 | F2-T01 — base visual **+ nova home** — **feito** (28/10, PR #9) | tokens, `components/ui/`, `AppLayout` com cabeçalho, rotas finais, 375 px; a home vira página de produto (ver a tarefa) |
| 2 | F3-T07 — cliente da API | **feito** (28/10) — direto na API real (sem *mock*: a trilha A já tinha terminado) |
| 3 | F3-T08 + F3-T13 — `/novo` | **feito** (28/10, PR #10) — gabarito, editor (girar/recortar/ampliar), cm; sem escolha de qualidade (ADR 0009) |
| 4 | F3-T09 — status por etapa | **feito** (28/10) — *polling* de 1 s até concluir/erro |
| 5 | F3-T10 + F3-T14 — `/modelos/:id` | **feito** (28/10) — estúdio 3D completo embutido, aba Fotos com contorno, baixar `.glb` |
| 6 | F3-T11 — `/modelos` | **feito** (28/10) — cartões, apagar com confirmação |

`/visualizador` e `/fotos` continuam como **estúdio** (demonstração para a banca, com os tênis de exemplo); o detalhe do
modelo já usa o mesmo estúdio 3D embutido (`Visualizador urlFixa`).

**Fechamento do MVP (todos)**
1. F3-T12 — E2E com Playwright (e F2-T09 junto, mesma ferramenta). **feito** (28/10) — `make e2e`; no CI só manual.
2. F0-T10 — foto tirada pelo grupo + fita métrica → erro dimensional (< 5 %). **falta** (trabalho do grupo).
3. `docs/revisoes/fase-3.md` **feito** (28/10); tag `v0.1.0-mvp` (depois do merge) e vídeo curto da demo **faltam**.

**Depois do MVP (conforme a data de entrega)**
- ~~Presets (F1-T01, F5-T04)~~ — **cancelados** em 28/10: configuração única, sem escolha técnica (ADR 0009, regra 11).
- F4-T05 — `.obj`/`.stl` só como opção no download, **se alguém pedir** (o modelo é sempre o mesmo).
- F4-T01/T02 — login e créditos **só se** a professora exigir conta de usuário.
- F5-T01 — Raio-X do pipeline: **feito** (28/10). F5-T07 — apresentação: **roteiro pronto** (`docs/apresentacao/roteiro.md`); slides, ensaio e vídeo com o grupo.

**Pendências sem dono:** data de entrega · responsáveis de cada trilha (tabela Equipe) · proteção da `main` (F0-T08).

## Fase 0 — Setup e prova de conceito

| ID | Tarefa | Responsável | Status | Observação |
|---|---|---|---|---|
| F0-T01 | Estrutura do monorepo | Claude | feito | 30/09 |
| F0-T02 | Workspace Python com uv | Claude | feito | 30/09 |
| F0-T03 | Pipeline mínimo (PoC) | Claude | feito | 10 testes passando |
| F0-T04 | Gerador de fotos sintéticas | Claude | feito | |
| F0-T05 | API FastAPI esqueleto | Claude | feito | `/health/db` ok |
| F0-T06 | PostgreSQL via Docker | Claude | feito | testado com Postgres 16 nativo; compose não testado no ambiente do Claude |
| F0-T07 | Front React + Three.js esqueleto | Claude | feito | prints em `docs/revisoes/assets/` |
| F0-T08 | Subir para o repo e CI | Pedro | em andamento | repo `PedroFiel/relevo` e CI (ruff, pytest com Postgres 16, oxlint, vitest, build) existem; falta conferir a proteção da `main` |
| F0-T09 | Cada integrante roda o setup | todos | em andamento | Pedro: ok (testes, banco Neon, visualizador). Faltam os demais |
| F0-T10 | Prova com fotos reais | Pedro + Claude | em andamento | 3 tênis de catálogo reconhecíveis, coloridos, fechados, escala exata; tenis-03 com 5 vistas, recorte e seção. Falta foto própria + fita métrica. Relatórios: `docs/testes/relatorios/2026-10-01-*.md` |

## Fase 1 — Pipeline completo

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F1-T01 | Configuração e presets | — | **cancelada** (28/10, ADR 0009: configuração única) |
| F1-T02 | Suavização de Taubin | | a fazer |
| F1-T03 | Decimação por erro quádrico | Pedro + Claude | feito (28/10: 20 mil faces, *fallback* se abrir a malha) |
| F1-T04 | Transformação inversa 3D → pixel | | a fazer |
| F1-T05 | Cor por vértice | Pedro + Claude | feito |
| F1-T06 | Segmentação robusta | Pedro + Claude | feito |
| F1-T07 | Métricas (IoU, consistência) | Pedro + Claude | em andamento |
| F1-T08 | Intermediários + progresso | Pedro + Claude | feito (28/10: callback + máscaras, voxels de superfície e malha bruta; a "suave" vem com a F1-T02) |
| F1-T09 | Desempenho | | a fazer |
| F1-T10 | Notebook didático | | a fazer |
| F1-T11 | Ajuste da foto: recorte e rotação | Pedro + Claude | feito |
| F1-T12 | Rastreamento de contorno | Pedro + Claude | feito |

## Fase 2 — Visualizador 3D

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F2-T01 | Base visual e layout (+ home) | Pedro + Claude | feito (28/10: tokens, `components/ui`, `AppLayout`, home, `/guia`) |
| F2-T02 | Câmera e controles | | a fazer |
| F2-T03 | Modos de renderização | | a fazer |
| F2-T04 | Iluminação controlável | | a fazer |
| F2-T05 | Shader customizado (GLSL) | | a fazer |
| F2-T06 | Ajudantes visuais | | a fazer |
| F2-T07 | Estatísticas do modelo | | a fazer |
| F2-T08 | Abrir arquivo local | Pedro + Claude | feito |
| F2-T09 | Testes visuais (Playwright) | Pedro + Claude | feito (28/10: prints por modo com WebGL por software) |
| F2-T10 | Visor 2D: janela→viewport, zoom, pan, clipping | Pedro + Claude | feito |
| F2-T11 | Plano de corte 3D (clipping + stencil) | Pedro + Claude | feito |
| F2-T12 | Zoom no ponto e cursor (raycasting) | Pedro + Claude | feito (27/10: modo Lente (FOV) tirado) |
| F2-T13 | Mover, girar, aumentar (matriz 4×4) | Pedro + Claude | feito |
| F2-T14 | Selecionar área, separar e mover | Pedro + Claude | feito |
| F2-T15 | Rastreamento de raios × rasterização | Pedro + Claude | feito |

## Fase 3 — Integração (MVP)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F3-T01 | Modelos ORM e migração | Pedro + Claude | feito (27/10: 6 tabelas + usuário demo, aplicado no Neon) |
| F3-T02 | Storage local | Pedro + Claude | feito (28/10: `LocalStorage` + `get_storage`; chave com `..` recusada) |
| F3-T03 | Schemas + POST /modelos | Pedro + Claude | feito (28/10) |
| F3-T04 | Banco de teste e fixtures | Pedro + Claude | feito (28/10: fixture `cliente` com `get_db` e `get_storage` trocados) |
| F3-T05 | Execução do job | Pedro + Claude | feito (28/10: progresso, erro amigável, delete no meio, *startup*) |
| F3-T06 | Endpoints de leitura | Pedro + Claude | feito (28/10: + `GET /imagens/{id}`) |
| F3-T07 | Cliente da API | Pedro + Claude | feito (28/10) |
| F3-T08 | Página Novo modelo | Pedro + Claude | feito (28/10; prévia da silhueta no navegador ficou de fora) |
| F3-T09 | Status do processamento | Pedro + Claude | feito (28/10) |
| F3-T10 | Detalhe + visualizador integrado | Pedro + Claude | feito (28/10) |
| F3-T11 | Meus modelos | Pedro + Claude | feito (28/10) |
| F3-T12 | E2E do MVP | Pedro + Claude | feito (28/10: `make e2e`, API :8001 no `relevo_test`) |
| F3-T13 | Editor da foto no upload (cortar, girar, ampliar) | Pedro + Claude | feito (28/10: editor no `/novo`, miniatura já ajustada, `ajustes` no `POST /modelos`) |
| F3-T14 | Segmentação e contorno visíveis no resultado | Pedro + Claude | feito (28/10: aba "Fotos e contornos" do modelo lendo da API) |

## Fase 4 — Produto

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F4-T01 | Autenticação | | a fazer |
| F4-T02 | Créditos | | a fazer |
| F4-T03 | Editor de transformações | | a fazer |
| F4-T04 | Versões no back | | a fazer |
| F4-T05 | Outros formatos no download | | a fazer (só se pedirem; ADR 0009) |
| F4-T06 | Mapeamento UV e textura | | a fazer |
| F4-T07 | Modo UV no visualizador | | a fazer |
| F4-T08 | Storage S3 (MinIO) | | a fazer |

## Fase 5 — Diferenciais e apresentação

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F5-T01 | Raio-X do pipeline | Pedro + Claude | feito (28/10: aba na página do modelo, 6 etapas, apresentação automática) |
| F5-T02 | LOD | | a fazer |
| F5-T03 | Régua 3D | | a fazer |
| F5-T04 | Presets na interface | — | **cancelada** (28/10, ADR 0009) |
| F5-T05 | Pincel de correção | | a fazer |
| F5-T06 | Visualizador incorporável | | a fazer |
| F5-T07 | Apresentação | todos | em andamento (28/10: roteiro, imagens e perguntas da banca; faltam slides, ensaio e vídeo) |

## Riscos e bloqueios

| Risco | Impacto | Plano |
|---|---|---|
| Fotos reais segmentam mal (sombra, fundo parecido) | alto | F0-T10 cedo; F1-T06 chroma key; F5-T05 pincel |
| Perspectiva das fotos de celular distorce o hull | médio | guia de fotos (afastar + zoom); `razao_frente` já avisa; IoU completo na F1-T07 |
| Usuário envia foto girada/espelhada | médio | orientação automática por anatomia + aviso (feito); avisa quando a silhueta é ambígua |
| Computador fraco de algum integrante | baixo | resolução 96 em dev; CI roda os testes |
| Prazo | alto | MVP = Fases 0–3; Fase 5 prioriza T01 e T07 |
| Conceitos exigidos pela professora (recorte, zoom, transformações, rastreamento, segmentação) | alto | 8 tarefas novas no MVP (ADR 0006); confirmar o sentido de "rastrear" com ela |
