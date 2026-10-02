# RELEVO — Guia do repositório

> Leia este arquivo inteiro antes de qualquer tarefa. Ele resume **o que é o projeto, o que já foi decidido,
> as regras que não se negociam e como trabalhamos**. Os detalhes estão em `docs/` (mapa no fim).
> Se algo aqui conflitar com outro documento, **este arquivo vence** — e o outro documento deve ser corrigido.

---

## 1. O projeto em uma frase

**RELEVO converte 3 fotos de um tênis (lateral, de cima e frontal — até 6, com outro lado, sola e traseira) em um modelo 3D pronto para usar
(.glb / .obj / .stl), em escala real, usando apenas técnicas clássicas de Computação Gráfica — sem IA.**

- **Contexto:** trabalho em grupo da disciplina de Computação Gráfica (Engenharia de Computação — UNASP).
- **Formato:** um produto SaaS completo, com as 3 frentes obrigatórias: **front-end, back-end e banco de dados**.
- **Segmento:** Serviços — Tecnologia da Informação (desenvolvimento de software, modelo SaaS).
- **Foco de produto:** calçados (tênis) para lojistas de moda / e-commerce.

## 2. Empresa: visão, missão e valores

- **Visão:** ser referência em tornar a criação 3D acessível a qualquer pessoa, sem exigir domínio de software de modelagem.
- **Missão:** converter imagens em modelos 3D prontos para uso, em segundos, eliminando a barreira técnica e o custo da
  modelagem tradicional.

Os valores **guiam decisões de código e de produto**:

| Valor | O que significa na prática, aqui no repositório |
|---|---|
| **Agilidade** | Pipeline rápido (meta < 10 s). MVP primeiro, refinamento depois. Tarefas pequenas, PRs pequenos. |
| **Acessibilidade** | O usuário não precisa saber nada de 3D: upload guiado com gabarito, textos simples, mensagens de erro que dizem *o que fazer*. Funciona no celular (375 px). |
| **Qualidade de entrega** | Malha sempre fechada, escala real correta, testes para toda tarefa, CI verde antes do merge. |
| **Propriedade do criador** | O modelo é do usuário: download livre nos formatos abertos, sem marca d'água, apagar o modelo apaga os arquivos. |
| **Transparência sobre os limites** | Dizemos ao usuário o que o algoritmo **não** consegue (abertura do pé fechada, lado oposto espelhado e solado cinza quando faltam essas fotos, seção estimada). Métricas de qualidade visíveis. Nunca vender como "IA". |

## 3. Objetivos

### 3.1 Objetivo acadêmico (o que a banca precisa ver)
Demonstrar, **implementados e explicáveis**, os conceitos de Computação Gráfica:

| Conceito | Onde aparece |
|---|---|
| Processamento de imagem e **segmentação** (distância de cor em Lab, morfologia matemática) | pipeline — segmentação; front — máscara/contorno sobre a foto (F3-T14) |
| **Recorte 2D (cortar / clipping)**: janela→viewport, Cohen–Sutherland, Sutherland–Hodgman | pipeline (recorte da foto, F1-T11) e front (visor 2D, F2-T10; editor de foto, F3-T13) |
| **Ampliar / zoom e pan** (zoom em torno de um ponto, *dolly* × FOV) | front (visor 2D, F2-T10; zoom no ponto 3D, F2-T12) |
| **Rastreamento de contorno** (Suzuki–Abe / Moore) + Douglas–Peucker | pipeline (F1-T12) |
| **Recorte 3D** (plano de corte, *frustum*, *stencil*) | front (F2-T11) |
| Projeção ortográfica e perspectiva | pipeline (visual hull) e front (câmeras) |
| Voxelização e visual hull (shape from silhouette) | pipeline |
| Marching Cubes (campo implícito → malha) | pipeline |
| Malhas poligonais, normais, suavização (Taubin) e decimação (erro quádrico) | pipeline |
| Projeção de textura, mapeamento UV, PBR | pipeline (cor/textura) e front (modo UV) |
| Pipeline gráfico, rasterização, iluminação e shading | front (WebGL / Three.js) |
| Shaders programáveis (GLSL) | front |
| Transformações com matrizes homogêneas 4×4 (**mover, girar, aumentar**, pivô) | front (F2-T13 no MVP; pivô/versões na F4-T03) e back (versões) |
| Raycasting (o ponto sob o cursor) | front (zoom no ponto e cursor, F2-T12; pivô; régua 3D) |
| **Rastreamento de raios** (ray tracing): BVH, Möller–Trumbore, raio de sombra × rasterização | front (aba Rastrear raios, F2-T15) |
| **Selecionar área → recortar → mover** (janela de seleção, Sutherland–Hodgman 3D, nó com matriz própria) | front (aba Selecionar e mover, F2-T14) |
| LOD (níveis de detalhe) | pipeline + front |

### 3.2 Objetivo de produto
- **MVP (Fases 0–3):** subir 3 fotos no site (cortando/girando/ampliando se precisar) → acompanhar o processamento por
  etapa → ver o contorno detectado em cada foto → ver o tênis 3D colorido no navegador (zoom no ponto, plano de corte,
  mover/girar/aumentar) → baixar o .glb → encontrá-lo depois em "Meus modelos". Tudo persistido no PostgreSQL.
- **Produto (Fase 4):** conta e créditos, editor de escala/rotação/pivô, versões, exportação .obj/.stl, textura UV, S3.
- **Diferenciais (Fase 5):** Raio-X do pipeline (mostra cada etapa), LOD, régua 3D, presets, correção de máscara, embed.

### 3.3 Critérios de sucesso (metas mensuráveis)
| Métrica | Meta |
|---|---|
| Malha fechada (*watertight*) | sempre |
| Erro dimensional vs. medida real (fita métrica) | < 5 % |
| IoU de reprojeção (modelo × silhuetas) | > 0,90 |
| Tempo do pipeline (resolução 128) | < 10 s |
| Faces no preset e-commerce | ≈ 20 mil |
| Testes automatizados | 100 % passando no CI |

## 4. Decisões tomadas (não reabrir sem motivo forte + ADR)

| # | Decisão | Por quê | Registro |
|---|---|---|---|
| D1 | **Nenhuma IA no núcleo de conversão** (TripoSR e afins foram descartados) | requisito da disciplina | ADR 0001 |
| D2 | **Fotos em vistas ortogonais padronizadas**: lateral e topo obrigatórias, frontal recomendada; outro lado, sola e traseira opcionais | 1 foto não tem profundidade sem IA | ADR 0001, 0007 |
| D3 | **Reconstrução por visual hull** (escultura de voxels) + **Marching Cubes**; a malha sai do campo de distância assinada das silhuetas | clássico, explicável, implementável; sem degraus | ADR 0001, 0005 |
| D4 | **Segmentação clássica** (Otsu + morfologia; chroma key como alternativa) — nunca rede neural | idem D1 | `docs/03-pipeline-cg.md` |
| D5 | **Back-end único em Python/FastAPI** (não NestJS) importando o pipeline como pacote | menos peças, MVP mais rápido | ADR 0002 |
| D6 | **Jobs com BackgroundTasks do FastAPI + polling** (sem Redis/Celery) | volume acadêmico | ADR 0003 |
| D7 | **Cor por vértice no MVP; textura UV (xatlas) na Fase 4** | cor cedo sem atrasar o MVP | ADR 0004 |
| D8 | **PostgreSQL 16** com JSONB para parâmetros/métricas/matrizes; migrações só via Alembic | dados relacionais + flexibilidade | `docs/04-banco-de-dados.md` |
| D9 | **Storage local no MVP → S3/MinIO na Fase 4**, atrás da mesma interface `Storage` | simplicidade agora, troca sem refatorar | `docs/fases/fase-3…` |
| D10 | **Usuário "demo" fixo no MVP**; autenticação JWT só na Fase 4 | foco no fluxo principal | `docs/04-banco-de-dados.md` |
| D11 | **Front com React + TypeScript + Vite + Three.js via react-three-fiber/drei** | conceitos de CG explícitos + produtividade | `docs/01-stack.md` |
| D12 | **Monorepo com workspace `uv`** (Python) + npm (front) | um lockfile, setup em minutos | `docs/01-stack.md` |
| D13 | **Escala real em centímetros** informada pelo usuário (comprimento do calcanhar ao bico) | modelo útil para loja e impressão 3D | `docs/03-pipeline-cg.md` |
| D14 | **Ordem de entrega: Fase 0 → (1 ∥ 2) → 3 = MVP → 4 → 5** | reduzir risco cedo, paralelizar | `docs/fases/README.md` |
| D15 | **Recorte (2D e 3D), zoom, transformações, rastreamento e segmentação visíveis entram no MVP** | exigência da professora | ADR 0006 |
| D16 | **Até 6 vistas + registro por IoU + seção transversal comum (cilindro generalizado)** | cor real de todos os lados e forma sem "caixa" | ADR 0007 |
| D17 | **"Rastrear" = rastreamento de raios; selecionar/separar/mover; ferramentas ao lado do modelo; API de dev para regerar amostras** | pedido da professora + revisão de uso | ADR 0008 |

## 5. Regras inegociáveis

1. **Sem IA no produto.** Proibido adicionar ao projeto: `rembg`, `torch`, `tensorflow`, `onnxruntime`, `transformers`,
   `segment-anything`, `mediapipe`, TripoSR, modelos pré-treinados ou APIs de geração 3D (Meshy, Luma, CSM etc.).
   Permitido: OpenCV (funções clássicas), NumPy, SciPy, scikit-image, trimesh, fast-simplification, xatlas, Pillow.
   Dependência nova → justificar no PR; se relevante, criar ADR.
2. **Commits, PRs e issues sem atribuição automática.** O autor é sempre o integrante do grupo.
   **Nunca** incluir `Co-Authored-By`, qualquer outro *trailer*, link de sessão, rodapé "gerado por" ou qualquer menção a
   ferramentas de assistência de código / IA — nem na mensagem, nem na descrição do PR, nem em comentários de código.
   (As configurações do ambiente de desenvolvimento do repositório já desligam isso; mesmo assim, conferir antes de cada commit.)
3. **Nada entra na `main` sem teste.** Toda tarefa traz seus testes; `make test` e `make lint` verdes; PR revisado.
4. **Documentação anda junto com o código.** Toda tarefa atualiza `docs/acompanhamento/STATUS.md` e o diário; mudanças
   visíveis vão para o `CHANGELOG.md`; mudança de algoritmo/API/banco atualiza o doc correspondente.
5. **Banco só muda por migração Alembic**, revisada à mão, com `downgrade` funcionando.
6. **Nunca commitar** `.env`, `storage/`, `out/`, `node_modules/`, `.venv/`, segredos ou fotos > 1 MB.
7. **Convenção de eixos e unidades é lei** (seção 8). Quebrar isso quebra o pipeline inteiro.
8. **Escopo muda só com registro**: nova funcionalidade fora das fases → discutir e registrar (ADR ou fase).
9. **Tudo em português** (código, comentários, docs, commits); identificadores sem acento.
10. **Transparência no produto**: mensagens de erro e limitações sempre explicadas ao usuário em linguagem simples.

## 6. Stack

| Camada | Tecnologias |
|---|---|
| Pipeline (núcleo de CG) | Python 3.11+, NumPy, OpenCV (headless), SciPy, scikit-image, trimesh, fast-simplification, xatlas |
| Back-end | FastAPI, Uvicorn, SQLAlchemy 2, psycopg 3, Alembic, pydantic-settings |
| Banco | PostgreSQL 16 (Docker Compose, com Adminer) |
| Storage | disco local (MVP) → S3/MinIO (Fase 4) |
| Front-end | React 19, TypeScript, Vite, Three.js, @react-three/fiber, @react-three/drei, React Router, TanStack Query |
| Qualidade | pytest, ruff, Vitest + Testing Library, oxlint, Playwright (Fase 2+) |
| Infra | uv, npm, Docker Compose, GitHub Actions, Makefile |

## 7. Estrutura

```
relevo/
├── apps/
│   ├── api/            FastAPI (src/relevo_api), Alembic (migrations/), testes
│   └── web/            React + Three.js (src/pages, src/components, src/lib), Vitest
├── packages/
│   └── pipeline/       núcleo de CG (src/relevo_pipeline): segmentacao, alinhamento, voxel, malha, exportar, cli
├── docs/               documentação (fonte da verdade do plano)
├── samples/            sintetico/ (gerado) e reais/ (fotos do grupo)
├── notebooks/          notebooks didáticos (Fase 1)
├── .github/            CI e templates de PR/issue
├── docker-compose.yml  PostgreSQL + Adminer
└── Makefile            atalhos
```

## 8. Convenções técnicas

**Eixos 3D (todo o projeto):** `x` = comprimento (calcanhar → bico) · `y` = altura (chão → topo) · `z` = largura.
**Unidade:** centímetros. O modelo final fica centrado em x/z e apoiado em `y = 0`.

**Vistas (fotos):**

| Vista | Linhas da imagem | Colunas da imagem | Posição na foto |
|---|---|---|---|
| `lateral` | y (topo da foto = topo do tênis) | x | calcanhar à esquerda, bico à direita |
| `topo` | z | x | calcanhar à esquerda, bico à direita |
| `frente` | y | z | olhando o bico |
| `outro_lado` | y | x | calcanhar à **direita** (câmera do outro lado) |
| `sola` | z | x | de baixo; qualquer sentido (giramos sozinhos) |
| `tras` | y | z | olhando o calcanhar |

Cada vista vai a um de 3 quadros canônicos (lateral, topo, frente) pelo espelhamento físico da câmera — fonte única
em `packages/pipeline/src/relevo_pipeline/vistas.py`. Rotações são sempre no sentido **horário**.

**Pipeline:** etapas são funções puras (sem I/O, exceto `cli.py` e `exportar.py`); tudo vetorizado com NumPy
(sem laço Python por voxel/vértice); cada etapa nova reporta métricas em `ResultadoPipeline.metricas`.

**Back-end:** rotas em `routers/`, regras em `servicos/`, schemas Pydantic em `schemas.py`; erros com mensagem amigável
em português; validar tipo/tamanho de arquivo pelos bytes, não pela extensão.

**Banco:** tabelas no plural, snake_case, em português; PK UUID; datas `timestamptz`; status via `CHECK`.

**Front-end:** páginas em `src/pages`, componentes em `src/components`, lógica pura e testável em `src/lib`,
shaders em `src/shaders`; materiais/geometrias em `useMemo` e liberados com `dispose`; layout funcional em 375 px.

**Python:** ruff (linha 100), type hints. **TypeScript:** strict, oxlint.

## 9. Fluxo de trabalho (toda tarefa, toda sessão)

1. Ler `docs/acompanhamento/STATUS.md` → identificar a fase atual e a próxima tarefa (ID `Fx-Tyy`).
2. Ler a tarefa em `docs/fases/fase-x-*.md` (Como fazer, Testes, Aceite).
3. Criar branch: `fase-<n>/<id>-<descricao-curta>` — ex.: `fase-1/f1-t02-suavizacao-taubin`.
4. Implementar seguindo o "Como fazer". Se precisar desviar, registrar o motivo.
5. Escrever/rodar os testes da tarefa; `make test` e `make lint` verdes.
6. Atualizar docs: STATUS (status + responsável), diário do dia (`docs/acompanhamento/diario/AAAA-MM-DD.md`,
   a partir do `TEMPLATE.md`), CHANGELOG se visível, ADR se houve decisão.
7. Commit(s) no padrão abaixo e PR com o template; revisão com `docs/revisoes/checklist-revisao.md`.
8. Fim de fase → `docs/revisoes/fase-N.md` (a partir do `TEMPLATE-fase.md`) + tag.

## 10. Padrão de commits e branches

- **Conventional Commits em português**, sem acento no assunto, imperativo/nominal curto:
  `tipo(escopo): descricao [Fx-Tyy]`
  - tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`
  - escopos: `pipeline`, `api`, `db`, `web`, `docs`, `ci`
  - ex.: `feat(pipeline): suavizacao de Taubin [F1-T02]`
- Corpo opcional explicando o porquê. **Sem trailers** (regra 2).
- Um commit por mudança lógica; não misturar frentes num mesmo commit quando der para separar.
- `main` protegida: só via PR com CI verde.

## 11. Comandos

```bash
make setup      # uv sync --all-packages + npm install + cria .env
make db-up      # PostgreSQL (5432) + Adminer (8080)
make migrate    # alembic upgrade head
make poc        # fotos sintéticas -> pipeline -> apps/web/public/samples/tenis-exemplo.glb
make api        # http://localhost:8000  (docs em /docs)
make web        # http://localhost:5173  (/visualizador)
make test       # pytest + vitest
make lint       # ruff + oxlint

uv run relevo-pipeline gerar --lateral L.jpg --topo T.jpg --frente F.jpg --comprimento-cm 28 --saida out/x.glb --debug out/x
cd apps/api && uv run alembic revision --autogenerate -m "mensagem"
```

## 12. Onde estamos

- **Fase atual:** 0 — Setup e prova de conceito, com boa parte das Fases 1 e 2 adiantada: pipeline com até 6 vistas,
  recorte/rotação da foto, orientação automática, registro por IoU, contorno rastreado, visual hull por SDF + seção
  transversal, cor por vértice e avisos; visualizador com plano de corte, zoom no ponto/raycasting e transformações 4×4;
  página `/fotos` com visor 2D (zoom, pan, clipping) e editor de recorte. API só com health checks; banco com baseline.
  3 tênis de catálogo (`samples/reais/`) geram modelos reconhecíveis (`make reais`).
- **Pendente na Fase 0:** F0-T08 (repo + CI), F0-T09 (setup de cada integrante), **F0-T10 (fotos tiradas pelo grupo +
  fita métrica — falta o erro dimensional)**.
- **Sempre confirme em `docs/acompanhamento/STATUS.md`** — ele é atualizado a cada sessão; este parágrafo pode estar defasado.

## 13. Limites conhecidos (comunicar, não esconder)

- Concavidades não aparecem em nenhuma silhueta → **abertura do pé fica fechada** (limite teórico do visual hull).
- Sem a foto do outro lado, ele usa a lateral **espelhada**; sem a foto da sola, o **solado** fica com cor neutra.
- A seção transversal é uma **hipótese** (todas as fatias com o mesmo perfil, ADR 0007): arredonda o "bico quadrado",
  mas detalhes que nenhuma silhueta mostra continuam inventados. `--sem-secao` volta ao visual hull puro.
- Fotos de celular têm perspectiva; o algoritmo assume vista ortográfica → pedir câmera afastada + zoom.
- Tênis claro em fundo claro (ou escuro em escuro) segmenta mal → pedir fundo contrastante; chroma key e pincel de correção.

## 14. Fora de escopo

Qualquer técnica de IA/aprendizado de máquina · fotogrametria com dezenas de fotos · fotos em ângulos livres com
calibração de câmera (só como extensão opcional) · app mobile nativo · pagamentos reais.

## 15. Mapa da documentação

| Assunto | Arquivo |
|---|---|
| Visão do produto, público, escopo | `docs/00-visao-geral.md` |
| Stack e justificativas | `docs/01-stack.md` |
| Arquitetura e fluxos (diagramas) | `docs/02-arquitetura.md` |
| Pipeline de CG: teoria + código | `docs/03-pipeline-cg.md` |
| Banco (ER + tabelas) | `docs/04-banco-de-dados.md` |
| Contrato da API | `docs/05-api.md` |
| Guia de fotos (vira tela de ajuda) | `docs/06-guia-de-fotos.md` |
| Ferramentas parecidas → conceitos → tarefas | `docs/08-ferramentas-similares.md` |
| **Cada ferramenta de CG: como usar, como funciona, código, testes** | `docs/09-funcionalidades-cg.md` |
| Setup passo a passo | `docs/07-setup.md` |
| Fases e tarefas | `docs/fases/` |
| Status, changelog, diário | `docs/acompanhamento/` |
| Plano e relatórios de testes | `docs/testes/` |
| Checklist e revisões de fase | `docs/revisoes/` |
| Decisões (ADRs) | `docs/decisoes/` |
