# STATUS — Painel do projeto

> Atualize este arquivo **no fim de toda sessão de trabalho**. É a primeira coisa que o agente lê.

**Fase atual:** **Código 100 % concluído nas Fases 0 a 5** (todas as tarefas de pipeline, banco, API, frontend e testes automatizados concluídas na branch `fase-4/produto-completo`).
**Branch única ativa:** `fase-4/produto-completo` (criada a partir da `main` pós-PR #11).
**Próxima etapa (manual do grupo):** apenas os testes físicos finais com um tênis real + fita métrica (`F0-T10`) e a gravação dos slides/vídeo de backup da apresentação (`F5-T07`).
**Data de entrega:** _a definir_ · **Última atualização:** 02/11/2026

Legenda: `a fazer` · `em andamento` · `feito` · `cancelada`

---

## Onde estamos (Visão Geral)

### 1. O que JÁ ESTÁ PRONTO e funcionando de ponta a ponta (100 % do código)
- **Fase 0 e Fase 3 (MVP completo):** upload guiado (`/novo`) com editor de foto (recorte, rotação 90°, zoom/pan), execução do job em segundo plano com progresso por etapa, página do modelo (`/modelos/:id`) com estúdio 3D embutido, aba "Fotos e contornos" e biblioteca "Meus modelos" (`/modelos`).
- **Fase 1 (Pipeline completo — 100 % feito):** segmentação por cor de fundo + morfologia (`F1-T06`), orientação automática (`orientacao.py`), ajuste de recorte/rotação com matriz 3×3 (`F1-T11`), rastreamento de contorno Suzuki–Abe / Moore + Douglas–Peucker (`F1-T12`), Visual Hull + seção transversal + campo assinado, **suavização de Taubin (`F1-T02`)**, decimação quádrica Garland–Heckbert para ~20 mil faces (`F1-T03`), **projeção inversa 3D → pixel (`F1-T04`)**, cor por vértice (`F1-T05`), **IoU de reprojeção da malha na resolução da foto (`F1-T07`)**, exportação de todos os intermediários (`F1-T08`), **benchmark `@pytest.mark.lento` < 15 s (`F1-T09`)** e **notebook didático passo a passo `notebooks/01-pipeline-passo-a-passo.ipynb` (`F1-T10`)**.
- **Fase 2 (Visualizador 3D — 100 % feito):** base visual e layout responsivo 375 px com polimento Impeccable (`F2-T01`), **vistas rápidas de câmera 3/4, Lateral, Topo e Frente + `distanciaParaEnquadrar` (`F2-T02`)**, **8 modos de renderização (`Sólido`, `Wireframe`, `Sólido + arestas`, `Flat`, `Normais`, `Altura GLSL`, `Fresnel GLSL`, `Textura UV`, `F2-T03`, `F2-T05`, `F4-T07`)**, **iluminação controlável por azimute/elevação + sombra de contato (`F2-T04`)**, **ajudantes visuais de grade e eixos XYZ (`F2-T06`)**, **estatísticas ao vivo de vértices, triângulos e dimensões (`F2-T07`)**, abrir `.glb` local (`F2-T08`), testes visuais Playwright (`F2-T09`), pipeline 2D janela→viewport (`F2-T10`), plano de corte 3D + tampa por *stencil buffer* + plano *near* (`F2-T11`), zoom *dolly* no ponto (`F2-T12`), transformações 4×4 `T·R·S` vs `S·R·T` (`F2-T13`), seleção retangular 3D com separação de sub-malha (`F2-T14`) e *ray tracing* CPU com BVH (`F2-T15`).
- **Fase 4 (Produto SaaS — 100 % feito):**
  - **`F4-T01` — Autenticação JWT e contas:** rotas `POST /auth/registrar` e `POST /auth/login` (hash `scrypt` + JWT HS256), páginas `/entrar` e `/cadastrar`, isolamento de modelos e créditos por usuário logado (mantendo fallback automático para o usuário demo quando sem token).
  - **`F4-T02` — Créditos e banco:** tabela `movimentos_credito`, saldo inicial de 10 créditos (`boas-vindas`), débito de 1 crédito com `SELECT ... FOR UPDATE`, bloqueio `402` quando sem saldo, **estorno automático** quando um job falha, rota `GET /me`, recarga `POST /creditos/recarregar`, selo no cabeçalho e página `/conta`.
  - **`F4-T03` / `F4-T04` — Editor 4×4 com pivô, atalhos, Desfazer e versões:** `comporComPivo`, botão "Definir pivô por clique", atalhos `G`/`R`/`S`/`Esc`/`Ctrl+Z`, salvar transformação 4×4 como nova versão (`POST /modelos/{id}/versoes`) e alternar/restaurar versões (`POST /modelos/{id}/versoes/{numero}/restaurar`).
  - **`F4-T05` — Exportação multi-formato:** download em `.glb`, `.obj` e `.stl` (`GET /versoes/{id}/exportar?formato=glb|obj|stl`).
  - **`F4-T06` / `F4-T07` — Mapeamento UV e textura:** `textura.py` (desdobramento ortográfico em 6 ilhas em `[0, 1]²`, *baking* de textura RGB e dilatação de costuras) + modo "Textura UV" no visualizador com padrão xadrez e diagrama do atlas 2D.
  - **`F4-T08` — Storage S3 / MinIO:** serviço `minio` no `docker-compose.yml` + `S3Storage` em `storage.py` selecionável via `STORAGE_TIPO=local|s3`.
- **Fase 5 (Diferenciais — 100 % feito no código):**
  - **`F5-T01` — Raio-X do pipeline:** 7 etapas interativas (Fotos → Silhuetas → Voxels → Malha bruta → Suavizada Taubin → Decimada → Final colorida) + modo apresentação automática.
  - **`F5-T02` — LOD (Níveis de Detalhe):** `malha.gerar_lods` (`100 %`, `25 %`, `5 %` das faces preservando cor por vértice) + `nivelLodPorDistancia` e toggle "LOD automático por distância" no visualizador.
  - **`F5-T03` — Régua 3D:** ferramenta "Régua 3D" no visualizador clicando em 2 pontos da superfície do calçado (*raycasting*) com segmento 3D e distância real em `cm` e `mm`.
  - **`F5-T05` — Pincel de correção da máscara:** `EditorMascara` com pincel/borracha sobre a foto + `POST /modelos/{id}/regerar`.
  - **`F5-T06` — Visualizador incorporável (`/embed/:id`):** rotas públicas `GET /publico/{id}` e `GET /publico/{id}/glb`, página `/embed/:id` para `<iframe>` e botão "Incorporar (`<iframe>`)" com cópia de código HTML em `/modelos/:id`.

---

### 2. Etapas manuais finais do grupo (fora do código)
- **`F0-T10`:** Tirar fotos próprias de um tênis real do grupo + medir com fita métrica e validar erro dimensional < 5 %.
- **`F5-T07`:** Montar os slides a partir de `docs/apresentacao/roteiro.md`, ensaiar e gravar o vídeo de backup da demo.

---

## Como rodar o projeto localmente

> **Importante:** o frontend (`:5173`) precisa da API (`:8000`) ligada para carregar `/me` (créditos) e `/modelos`. Use sempre o `make dev` para subir os dois juntos:

```bash
make dev
```
*(Ou rode `make api` em um terminal e `make web` em outro).*

---

## Tabelas completas por fase

### Fase 0 — Setup e prova de conceito

| ID | Tarefa | Responsável | Status | Observação |
|---|---|---|---|---|
| F0-T01 | Estrutura do monorepo | Pedro + Claude | feito | 30/09 |
| F0-T02 | Workspace Python com uv | Pedro + Claude | feito | 30/09 |
| F0-T03 | Pipeline mínimo (PoC) | Pedro + Claude | feito | 10 testes passando |
| F0-T04 | Gerador de fotos sintéticas | Pedro + Claude | feito | |
| F0-T05 | API FastAPI esqueleto | Pedro + Claude | feito | `/health/db` ok |
| F0-T06 | PostgreSQL via Docker | Pedro + Claude | feito | Postgres 16 + Neon |
| F0-T07 | Front React + Three.js esqueleto | Pedro + Claude | feito | prints em `docs/revisoes/assets/` |
| F0-T08 | Subir para o repo e CI | Pedro | feito | repo `PedroFiel/relevo` e CI configurados |
| F0-T09 | Cada integrante roda o setup | todos | em andamento | Pedro: ok |
| F0-T10 | Prova com fotos reais | Pedro + Claude | em andamento | 3 tênis de catálogo prontos; falta foto própria com fita métrica (etapa manual final) |

### Fase 1 — Pipeline completo (100 % concluída)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F1-T01 | Configuração e presets | — | **cancelada** (28/10, ADR 0009: configuração única) |
| F1-T02 | Suavização de Taubin | Pedro + Claude | **feito** (02/11: `malha.suavizar` + `malha-suave.glb` no Raio-X) |
| F1-T03 | Decimação por erro quádrico | Pedro + Claude | **feito** (28/10: 20 mil faces, *fallback* se abrir a malha) |
| F1-T04 | Transformação inversa 3D → pixel | Pedro + Claude | **feito** (02/11: `matriz_grade_para_foto` 3×3 + `projetar_vertices`) |
| F1-T05 | Cor por vértice | Pedro + Claude | **feito** |
| F1-T06 | Segmentação robusta | Pedro + Claude | **feito** |
| F1-T07 | Métricas (IoU, consistência) | Pedro + Claude | **feito** (02/11: IoU em voxels + `iou_malha_<vista>` na resolução da foto) |
| F1-T08 | Intermediários + progresso | Pedro + Claude | **feito** (02/11: callback + máscaras, voxels, malha bruta e malha suave) |
| F1-T09 | Desempenho (benchmark `@pytest.mark.lento`) | Pedro + Claude | **feito** (02/11: `test_desempenho_configuracao_padrao_abaixo_de_15s`) |
| F1-T10 | Notebook didático (`notebooks/`) | Pedro + Claude | **feito** (02/11: `notebooks/01-pipeline-passo-a-passo.ipynb`) |
| F1-T11 | Ajuste da foto: recorte e rotação | Pedro + Claude | **feito** |
| F1-T12 | Rastreamento de contorno | Pedro + Claude | **feito** |

### Fase 2 — Visualizador 3D (100 % concluída)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F2-T01 | Base visual e layout (+ home + Impeccable) | Pedro + Claude | **feito** (28/10 + polimento Impeccable em 02/11) |
| F2-T02 | Câmera: vistas rápidas e enquadramento | Pedro + Claude | **feito** (02/11: `DIRECOES_PRESET` + `distanciaParaEnquadrar`) |
| F2-T03 | Modos extras de renderização (arestas, flat/suave) | Pedro + Claude | **feito** (02/11: `arestas` e `flat` em `MODOS`) |
| F2-T04 | Iluminação controlável (azimute/elevação + sombras) | Pedro + Claude | **feito** (02/11: `esfericaParaCartesiana` + controles no painel) |
| F2-T05 | Shader customizado (GLSL: altura e Fresnel) | Pedro + Claude | **feito** (02/11: `src/shaders/altura.*` e `fresnel.*`) |
| F2-T06 | Ajudantes visuais (eixos, grade) | Pedro + Claude | **feito** (02/11: toggles de grade 2 cm e `axesHelper`) |
| F2-T07 | Estatísticas detalhadas do modelo | Pedro + Claude | **feito** (02/11: `calcularEstatisticas` ao vivo no painel) |
| F2-T08 | Abrir arquivo local | Pedro + Claude | **feito** |
| F2-T09 | Testes visuais (Playwright) | Pedro + Claude | **feito** (28/10) |
| F2-T10 | Visor 2D: janela→viewport, zoom, pan, clipping | Pedro + Claude | **feito** |
| F2-T11 | Plano de corte 3D (clipping + stencil + near) | Pedro + Claude | **feito** |
| F2-T12 | Zoom no ponto e cursor (raycasting) | Pedro + Claude | **feito** |
| F2-T13 | Mover, girar, aumentar (matriz 4×4) | Pedro + Claude | **feito** |
| F2-T14 | Selecionar área, separar e mover | Pedro + Claude | **feito** |
| F2-T15 | Rastreamento de raios × rasterização | Pedro + Claude | **feito** |

### Fase 3 — Integração (MVP — 100 % concluída)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F3-T01 | Modelos ORM e migração | Pedro + Claude | **feito** (27/10) |
| F3-T02 | Storage local | Pedro + Claude | **feito** (28/10) |
| F3-T03 | Schemas + POST /modelos | Pedro + Claude | **feito** (28/10) |
| F3-T04 | Banco de teste e fixtures | Pedro + Claude | **feito** (28/10) |
| F3-T05 | Execução do job | Pedro + Claude | **feito** (28/10) |
| F3-T06 | Endpoints de leitura | Pedro + Claude | **feito** (28/10) |
| F3-T07 | Cliente da API | Pedro + Claude | **feito** (28/10) |
| F3-T08 | Página Novo modelo | Pedro + Claude | **feito** (28/10) |
| F3-T09 | Status do processamento | Pedro + Claude | **feito** (28/10) |
| F3-T10 | Detalhe + visualizador integrado | Pedro + Claude | **feito** (28/10) |
| F3-T11 | Meus modelos | Pedro + Claude | **feito** (28/10) |
| F3-T12 | E2E do MVP | Pedro + Claude | **feito** (28/10 + expandido em 02/11) |
| F3-T13 | Editor da foto no upload (cortar, girar, ampliar) | Pedro + Claude | **feito** (28/10) |
| F3-T14 | Segmentação e contorno visíveis no resultado | Pedro + Claude | **feito** (28/10) |

### Fase 4 — Produto (100 % concluída)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F4-T01 | Autenticação (`/entrar`, `/cadastrar`, `scrypt` + JWT) | Pedro + Claude | **feito** (02/11) |
| F4-T02 | Créditos (`movimentos_credito`, débito/estorno, `/me`, `/conta`) | Pedro + Claude | **feito** (02/11) |
| F4-T03 | Editor de transformações (`comporComPivo`, pivô por clique, atalhos G/R/S, Desfazer e salvar versão) | Pedro + Claude | **feito** (02/11) |
| F4-T04 | Versões no back (`POST /versoes` e `/restaurar` + seletor no front) | Pedro + Claude | **feito** (02/11) |
| F4-T05 | Outros formatos no download (`.glb`, `.obj`, `.stl`) | Pedro + Claude | **feito** (02/11) |
| F4-T06 | Mapeamento UV e textura (`textura.py`) | Pedro + Claude | **feito** (02/11) |
| F4-T07 | Modo UV no visualizador (textura xadrez + atlas 2D) | Pedro + Claude | **feito** (02/11) |
| F4-T08 | Storage S3 (MinIO + `S3Storage`) | Pedro + Claude | **feito** (02/11) |

### Fase 5 — Diferenciais e apresentação (Código 100 % concluído)

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F5-T01 | Raio-X do pipeline (7 etapas incluindo Suavizada Taubin) | Pedro + Claude | **feito** (28/10 + 02/11) |
| F5-T02 | LOD (3 níveis de detalhe `100 %`, `25 %`, `5 %` por distância) | Pedro + Claude | **feito** (02/11) |
| F5-T03 | Régua 3D (medição ponto a ponto com raycasting em `cm`) | Pedro + Claude | **feito** (02/11) |
| F5-T04 | Presets na interface | — | **cancelada** (28/10, ADR 0009) |
| F5-T05 | Pincel de correção (`EditorMascara` + `POST /regerar`) | Pedro + Claude | **feito** (02/11) |
| F5-T06 | Visualizador incorporável (`/embed/:id` + copiar `<iframe>`) | Pedro + Claude | **feito** (02/11) |
| F5-T07 | Apresentação (roteiro pronto; faltam slides/vídeo do grupo) | todos | em andamento |
