# STATUS — Painel do projeto

> Atualize este arquivo **no fim de toda sessão de trabalho**. É a primeira coisa que o Claude lê.

**Fase atual:** 0 — Setup e prova de conceito
**Próxima tarefa:** F0-T08 (subir para o repo do grupo e ligar o CI)
**Data de entrega:** _a definir_ · **Última atualização:** 30/09/2026

Legenda: `a fazer` · `em andamento` · `feito` · `bloqueado`

## Equipe

| Pessoa | Frente principal | Contato |
|---|---|---|
| Pedro | _a definir_ | |
| _integrante 2_ | | |
| _integrante 3_ | | |

Sugestão de divisão: 1–2 pessoas no **pipeline** (Fase 1), 1–2 no **front** (Fase 2), 1 no **back + banco** (prepara a Fase 3
enquanto as outras andam). Na Fase 3 todos convergem.

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
| F0-T08 | Subir para o repo e CI | | a fazer | |
| F0-T09 | Cada integrante roda o setup | todos | a fazer | |
| F0-T10 | Prova com fotos reais | | a fazer | **mais importante da fase** |

## Fase 1 — Pipeline completo

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F1-T01 | Configuração e presets | | a fazer |
| F1-T02 | Suavização de Taubin | | a fazer |
| F1-T03 | Decimação por erro quádrico | | a fazer |
| F1-T04 | Transformação inversa 3D → pixel | | a fazer |
| F1-T05 | Cor por vértice | | a fazer |
| F1-T06 | Segmentação robusta | | a fazer |
| F1-T07 | Métricas (IoU, consistência) | | a fazer |
| F1-T08 | Intermediários + progresso | | a fazer |
| F1-T09 | Desempenho | | a fazer |
| F1-T10 | Notebook didático | | a fazer |

## Fase 2 — Visualizador 3D

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F2-T01 | Base visual e layout | | a fazer |
| F2-T02 | Câmera e controles | | a fazer |
| F2-T03 | Modos de renderização | | a fazer |
| F2-T04 | Iluminação controlável | | a fazer |
| F2-T05 | Shader customizado (GLSL) | | a fazer |
| F2-T06 | Ajudantes visuais | | a fazer |
| F2-T07 | Estatísticas do modelo | | a fazer |
| F2-T08 | Abrir arquivo local | | a fazer |
| F2-T09 | Testes visuais (Playwright) | | a fazer |

## Fase 3 — Integração (MVP)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F3-T01 | Modelos ORM e migração | | a fazer |
| F3-T02 | Storage local | | a fazer |
| F3-T03 | Schemas + POST /modelos | | a fazer |
| F3-T04 | Banco de teste e fixtures | | a fazer |
| F3-T05 | Execução do job | | a fazer |
| F3-T06 | Endpoints de leitura | | a fazer |
| F3-T07 | Cliente da API | | a fazer |
| F3-T08 | Página Novo modelo | | a fazer |
| F3-T09 | Status do processamento | | a fazer |
| F3-T10 | Detalhe + visualizador integrado | | a fazer |
| F3-T11 | Meus modelos | | a fazer |
| F3-T12 | E2E do MVP | | a fazer |

## Fase 4 — Produto

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F4-T01 | Autenticação | | a fazer |
| F4-T02 | Créditos | | a fazer |
| F4-T03 | Editor de transformações | | a fazer |
| F4-T04 | Versões no back | | a fazer |
| F4-T05 | Exportação multi-formato | | a fazer |
| F4-T06 | Mapeamento UV e textura | | a fazer |
| F4-T07 | Modo UV no visualizador | | a fazer |
| F4-T08 | Storage S3 (MinIO) | | a fazer |

## Fase 5 — Diferenciais e apresentação

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F5-T01 | Raio-X do pipeline | | a fazer |
| F5-T02 | LOD | | a fazer |
| F5-T03 | Régua 3D | | a fazer |
| F5-T04 | Presets na interface | | a fazer |
| F5-T05 | Pincel de correção | | a fazer |
| F5-T06 | Visualizador incorporável | | a fazer |
| F5-T07 | Apresentação | todos | a fazer |

## Riscos e bloqueios

| Risco | Impacto | Plano |
|---|---|---|
| Fotos reais segmentam mal (sombra, fundo parecido) | alto | F0-T10 cedo; F1-T06 chroma key; F5-T05 pincel |
| Perspectiva das fotos de celular distorce o hull | médio | guia de fotos (afastar + zoom); medir com IoU na F1-T07 |
| Computador fraco de algum integrante | baixo | resolução 96 em dev; CI roda os testes |
| Prazo | alto | MVP = Fases 0–3; Fase 5 prioriza T01 e T07 |
