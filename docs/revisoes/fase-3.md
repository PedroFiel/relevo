# Revisão da Fase 3 — Integração (MVP)

**Período:** 27/10 – 28/10/2026 (mais o que já vinha das Fases 1–2) · **Participantes:** Pedro (+ Claude) ·
**Commit/tag:** `v0.1.0-mvp` — **a criar depois do merge** do PR da trilha B + fechamento

## Entregue

| ID | Tarefa | Status | Observação |
|---|---|---|---|
| F3-T01 | Modelos ORM e migração | feito | 6 tabelas + usuário demo, no Neon (PR #4) |
| F3-T02 | Storage local | feito | chave com `..`/link simbólico recusada; gravação atômica (PR #6) |
| F3-T03 | Schemas + `POST /modelos` | feito | foto validada pelos bytes; ajustes aplicados no envio (PR #8) |
| F3-T04 | Banco de teste e fixtures | feito | `relevo_test` com rollback por teste; fixture `cliente` (PR #7) |
| F3-T05 | Execução do job | feito | progresso por etapa, erro amigável, delete no meio, *startup* (PR #8) |
| F3-T06 | Endpoints de leitura | feito | + `GET /imagens/{id}` (PR #8) |
| F3-T07 | Cliente da API | feito | direto na API real |
| F3-T08 | Página Novo modelo | feito | sem a prévia da silhueta (opcional) |
| F3-T09 | Status do processamento | feito | etapas ao vivo, *polling* de 1 s |
| F3-T10 | Detalhe + visualizador | feito | o estúdio 3D inteiro embutido (`urlFixa`) |
| F3-T11 | Meus modelos | feito | apagar com confirmação |
| F3-T12 | E2E do MVP | feito | Playwright local (`make e2e`); no CI só manual |
| F3-T13 | Editor da foto no upload | feito | girar, recortar, ampliar; miniatura já ajustada |
| F3-T14 | Contorno visível no resultado | feito | aba "Fotos e contornos" + avisos |
| F1-T03 | Decimação (trilha A) | feito | 20 mil faces, *fallback* se abrir a malha (PR #8) |
| F1-T08 | Callback de progresso | feito (item 1) | intermediários do Raio-X ficam para a F5-T01 (PR #7) |
| F2-T01 | Base visual + home | feito | + `/guia` (PR #9) |
| F2-T09 | Testes visuais (Playwright) | feito | prints por modo, WebGL por software; não compara pixels |
| F0-T10 | Fotos do grupo + fita métrica | **adiado** | precisa do tênis e da fita — não dá para fazer por código |

## Demo

Roteiro (≈ 3 min). Antes: `make db-up` (ou o Neon do `.env`), `make api` e `make web` em dois terminais.

1. **Home** (`/`): a missão, os 3 passos e o bloco "o que o algoritmo não consegue" — sem IA, dito na primeira tela.
2. **Novo modelo** (`/novo`): mostrar o gabarito de cada vista; escolher `samples/reais/tenis-01/lateral.jpg`,
   `topo.jpg` e `frente.jpg`; em **Ajustar**, recortar a lateral (janela de recorte, F3-T13) e mostrar a miniatura
   recortada; nome, 30 cm, **Gerar modelo 3D**.
3. **Etapas ao vivo**: "Separar o tênis do fundo → … → Salvar o arquivo 3D" com a barra (≈ 2 s na qualidade Rápida).
4. **Modelo pronto**: o tênis colorido no estúdio — **Ampliar** no ponto (raycasting), **Recortar** com o plano de
   corte, **Selecionar e mover**, **Transformar** (matriz 4×4), **Rastrear raios** lado a lado com a GPU.
5. **Fotos e contornos**: o contorno rastreado (Suzuki–Abe + Douglas–Peucker) colado no tênis; ampliar 8× e mostrar
   que ele continua na borda (recorte de polígono na janela).
6. **Baixar .glb** e abrir em qualquer visualizador (ou no próprio "Abrir arquivo .glb…" do estúdio).
7. **Meus modelos** → apagar com confirmação (arquivos e linhas somem — "o modelo é do usuário").

Prints em `assets/`: `f3-novo-fotos.jpg`, `f3-novo-375px.jpg`, `f3-modelo-etapas.jpg`, `f3-modelo-pronto.jpg`,
`f3-modelo-fotos-contorno.png` e, do E2E, `f3-e2e-visualizador-{solido,wireframe,normais}.png`.
**Vídeo:** a gravar pelo grupo seguindo este roteiro.

## Métricas

Medidas em 28/10, resolução 128, `samples/reais`, comprimento informado 30 cm.

| Métrica | Meta | Resultado |
|---|---|---|
| Testes automatizados | 100 % passando | 158 pytest + 103 vitest + 3 Playwright, todos passando |
| Malha fechada | sempre | sim nos 3 tênis |
| Faces (preset e-commerce) | ≈ 20 mil | 20 000 nos 3 (antes: até 255 852 na resolução 256) |
| Tamanho do `.glb` | — | ≈ 0,52 MB (era 5–6,6 MB) |
| Tempo do pipeline | < 10 s | 1,03 s (tenis-01) · 1,10 s (tenis-02) · 0,46 s (tenis-03) |
| IoU de reprojeção (voxels × silhuetas) | > 0,90 | tenis-01: 0,985–0,989 · tenis-02: 0,983–0,997 · tenis-03: 0,913–0,986 |
| Erro da decimação | < 0,5 mm (médio) | 0,011–0,026 mm |
| Erro dimensional vs. fita métrica | < 5 % | **não medido** — falta a F0-T10 |
| Fluxo no celular (375 px) | sem rolagem horizontal | ok em `/`, `/novo`, `/modelos`, `/modelos/:id`, `/guia` |

## Conceitos de CG demonstrados nesta fase
- **Simplificação de malhas** por erro quádrico (Garland–Heckbert) e medição do erro geométrico (ponto–triângulo).
- **Transformações 2D** na miniatura do upload: a mesma rotação + recorte do `ajuste.py`, com a matriz do canvas.
- **Janela de recorte** interativa no editor (F2-T10 reaproveitado) e o **contorno** levado à foto original pela
  matriz 3×3 inversa do ajuste.
- **Pipeline gráfico em software** no teste: WebGL rodando por SwiftShader (sem GPU) no Playwright.
- Tudo o que já estava no estúdio (raycasting, plano de corte com *stencil*, 4×4, BVH + Möller–Trumbore) agora roda
  sobre o modelo que o usuário acabou de gerar.

## O que ficou para trás e por quê
- **F0-T10 (erro dimensional):** precisa de um tênis real medido com fita — trabalho do grupo, não de código. É a única
  meta mensurável ainda aberta.
- **Prévia da silhueta no navegador (F3-T08, opcional):** o contorno real do pipeline já aparece na aba Fotos.
- **Presets (F1-T01):** no lugar, "Qualidade" (resolução) no `/novo`.
- **E2E no CI a cada push:** ficou manual (`.github/workflows/e2e.yml`) para não gastar ~3 min por execução.
- **Tag `v0.1.0-mvp` e vídeo:** depois do merge.

## Decisões tomadas (ADRs)
- Sem ADR nova. Decisões menores, registradas nos diários de 27–28/10: `GET /imagens/{id}` e `job` no detalhe;
  apagar com o job rodando é permitido (o job limpa sozinho); F1-T03 antes da F1-T02; estúdio embutido na página do
  modelo; PRs maiores e CI com `concurrency`.

## Lições aprendidas
- **Funcionou bem:** contrato da API escrito antes (`docs/05-api.md`) — o front encaixou sem *mock*. Provar no
  navegador com a API e o banco de verdade achou o caso "apagar com o job rodando", que nenhum teste unitário pegou.
- **Não funcionou:** testes de rota contra o Neon (~150 ms por ida e volta) levam ~2 min; o painel de preview do app
  não consegue iniciar processos em `Documents` (permissão do macOS).
- **Mudaremos na próxima fase:** Postgres local para testes em casa (`TEST_DATABASE_URL`); um PR por pacote de tarefas.

## Pronto para a próxima fase?
**Sim, com condições:** (1) fazer a F0-T10 (foto própria + fita métrica) e registrar o erro dimensional; (2) gravar o
vídeo da demo; (3) depois do merge, criar a tag `v0.1.0-mvp`. A Fase 4 começa pela F4-T05 (exportar `.obj`/`.stl`).
