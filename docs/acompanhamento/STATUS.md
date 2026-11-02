# STATUS — Painel do projeto

> Atualize este arquivo **no fim de toda sessão de trabalho**. É a primeira coisa que o agente lê.

**Fase atual:** **Fase 4 (Produto) e Fase 5 (Diferenciais)** em andamento — Fases 0 a 3 (MVP) 100 % concluídas no código, além de F1-T02/T04/T07/T08, F4-T02/T03/T04/T05 e F5-T01/T05 já prontas na branch `fase-4/produto-completo`.
**Branch única ativa:** `fase-4/produto-completo` (criada a partir da `main` pós-PR #11).
**Próxima etapa de código sugerida:** concluir o restante da **Fase 4** (`F4-T01` Autenticação real com login/cadastro, `F4-T06`/`T07` Mapeamento UV e textura, `F4-T08` Storage S3/MinIO) e da **Fase 5** (`F5-T02` LOD, `F5-T03` Régua 3D, `F5-T06` Visualizador incorporável).
**Data de entrega:** _a definir_ · **Última atualização:** 02/11/2026

Legenda: `a fazer` · `em andamento` · `feito` · `cancelada`

---

## Onde estamos e o que falta desenvolver (Visão Geral)

### 1. O que JÁ ESTÁ PRONTO e funcionando de ponta a ponta
- **Fase 0 e Fase 3 (MVP completo):** upload guiado (`/novo`) com editor de foto (recorte, rotação 90°, zoom/pan), execução do job em segundo plano com progresso por etapa, página do modelo (`/modelos/:id`) com estúdio 3D embutido, aba "Fotos e contornos" e biblioteca "Meus modelos" (`/modelos`).
- **Fase 1 (Pipeline completo):** segmentação por cor de fundo + morfologia (`F1-T06`), orientação automática (`orientacao.py`), ajuste de recorte/rotação com matriz 3×3 (`F1-T11`), rastreamento de contorno Suzuki–Abe / Moore + Douglas–Peucker (`F1-T12`), Visual Hull + seção transversal + campo assinado, **suavização de Taubin (`F1-T02`)**, decimação quádrica Garland–Heckbert para ~20 mil faces (`F1-T03`), **projeção inversa 3D → pixel (`F1-T04`)**, cor por vértice (`F1-T05`), **IoU de reprojeção da malha na resolução da foto (`F1-T07`)** e exportação de todos os intermediários (`F1-T08`).
- **Fase 2 (Conceitos de CG no Visualizador):** base visual e layout responsivo 375 px (`F2-T01`), abrir `.glb` local (`F2-T08`), testes visuais Playwright (`F2-T09`), pipeline 2D janela→viewport com Cohen–Sutherland e Sutherland–Hodgman (`F2-T10`), plano de corte 3D + tampa por *stencil buffer* + recorte pelo plano *near* (`F2-T11`), zoom *dolly* no ponto via *raycasting* (`F2-T12`), transformações 4×4 `T·R·S` vs `S·R·T` (`F2-T13`), seleção retangular 3D com separação de sub-malha (`F2-T14`) e *ray tracing* CPU com BVH + sombra vs rasterização GPU (`F2-T15`).
- **Fase 4 (Fluxos já entregues):**
  - **`F4-T02` — Créditos e banco:** tabela `movimentos_credito`, saldo inicial de 10 créditos (`boas-vindas`), débito de 1 crédito com `SELECT ... FOR UPDATE`, bloqueio `402` quando sem saldo, **estorno automático** quando um job falha, rota `GET /me`, recarga `POST /creditos/recarregar`, selo no cabeçalho e página `/conta` (hoje operando sobre o usuário demo fixo até a `F4-T01`).
  - **`F4-T03` / `F4-T04` — Versões com matriz 4×4:** salvar transformação 4×4 como nova versão (`POST /modelos/{id}/versoes`) e alternar/restaurar versões (`POST /modelos/{id}/versoes/{numero}/restaurar`).
  - **`F4-T05` — Exportação multi-formato:** download em `.glb`, `.obj` e `.stl` (`GET /versoes/{id}/exportar?formato=glb|obj|stl`).
- **Fase 5 (Fluxos já entregues):**
  - **`F5-T01` — Raio-X do pipeline:** 7 etapas interativas (Fotos → Silhuetas → Voxels → Malha bruta → Suavizada Taubin → Decimada → Final colorida) + modo apresentação automática.
  - **`F5-T05` — Pincel de correção da máscara:** `EditorMascara` com pincel/borracha sobre a foto + `POST /modelos/{id}/regerar` pulando a segmentação automática nas vistas corrigidas.

---

### 2. O que FALTA desenvolver no código (Backlog por prioridade)

#### Bloco A — Fechar a Fase 4 (Produto SaaS)
| ID | Tarefa | Frente | O que falta fazer |
|---|---|---|---|
| **F4-T01** | **Autenticação real (Contas de usuário)** | banco, back, front | Atualmente `/conta` e os modelos usam o usuário demo fixo (`demo@relevo.local`). Falta: rotas `POST /auth/registrar` e `POST /auth/login` (hash Argon2 + token JWT), páginas `/entrar` e `/cadastrar`, guardar token no navegador, botão de Sair em `/conta` e isolar modelos/créditos por usuário logado. |
| **F4-T03b** | **Pivô por clique, atalhos G/R/S e Desfazer** | front | Salvar nova versão 4×4 já funciona. Falta o botão "Definir pivô" clicando num ponto 3D do modelo (`M = T(p)·R·S·T(−p)`), atalhos de teclado `G`/`R`/`S`/`Esc` e pilha de desfazer (`Ctrl+Z`). |
| **F4-T06** | **Mapeamento UV e textura (`textura.py`)** | pipeline | Parametrização UV da malha, *baking* de textura PNG 1024×1024 a partir das fotos com coordenadas baricêntricas e dilatação de bordas de ilhas UV. |
| **F4-T07** | **Modo UV no visualizador** | front | Modo de renderização "UV" com textura xadrez procedural (mostra distorção de parametrização) + visualização 2D do atlas UV no painel lateral. |
| **F4-T08** | **Storage S3 (MinIO)** | back, infra | Serviço `minio` no `docker-compose.yml` + implementação `S3Storage` (`boto3`) selecionável via `STORAGE_TIPO=local\|s3`. |

#### Bloco B — Fechar a Fase 5 (Diferenciais de CG)
| ID | Tarefa | Frente | O que falta fazer |
|---|---|---|---|
| **F5-T02** | **LOD (Níveis de Detalhe)** | pipeline, front | Gerar 3 níveis de malha (`100 %`, `25 %`, `5 %` das faces) e trocar automaticamente no visualizador conforme a distância da câmera (`<Detailed>`), mostrando na tela qual nível está ativo. |
| **F5-T03** | **Régua 3D (Medição ponto a ponto)** | front | Ferramenta "Medir" no visualizador: clicar em 2 pontos na superfície do tênis (*raycasting*), desenhar o segmento 3D entre eles e exibir a distância real em `cm`. |
| **F5-T06** | **Visualizador incorporável (`/embed/:id`)** | front, back | Rota pública `/embed/:id` apenas com o canvas 3D (sem cabeçalho/rodapé) + botão "Copiar código `<iframe>`" na página do modelo. |

#### Bloco C — Complementos didáticos das Fases 1 e 2
| ID | Tarefa | Frente | O que falta fazer |
|---|---|---|---|
| **F2-T02** | **Vistas rápidas de câmera e projeção ortográfica** | front | Botões para animar a câmera para Lateral / Topo / Frente / Perspectiva e alternar câmera Perspectiva × Ortográfica. |
| **F2-T03** | **Modos extras de renderização** | front | Adicionar modos "Sólido + arestas" (`<Edges>`), "Flat × Suave" (`flatShading`) e alternar cor por vértice vs material neutro. |
| **F2-T04** | **Iluminação controlável** | front | Sliders de intensidade ambiente e direção da luz (azimute/elevação esférica → cartesiana) + `DirectionalLightHelper` e sombras no chão. |
| **F2-T05** | **Shader customizado (GLSL)** | front | *Vertex/fragment shaders* próprios: mapa de calor por altura (`y` normalizado com faixas a cada 1 cm) e efeito Fresnel. |
| **F2-T06** | **Ajudantes visuais (Eixos, Grade e Caixa 3D)** | front | Toggles para `axesHelper`, grade em cm e `Box3Helper` com rótulos de comprimento × altura × largura no espaço 3D. |
| **F2-T07** | **Estatísticas detalhadas e FPS** | front | Contagem ao vivo de vértices/triângulos da cena carregada e medidor de FPS. |
| **F1-T09** | **Benchmark formal de desempenho** | pipeline | Teste `@pytest.mark.lento` garantindo execução < 15 s na configuração padrão e tabela resolução × tempo × faces. |
| **F1-T10** | **Notebook didático passo a passo** | pipeline | `notebooks/01-pipeline-passo-a-passo.ipynb` ilustrando cada etapa para apoio na apresentação. |

#### Bloco D — Etapas manuais do grupo (deixadas para depois que todo o código estiver pronto)
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

### Fase 1 — Pipeline completo

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
| F1-T09 | Desempenho (benchmark `@pytest.mark.lento`) | | a fazer |
| F1-T10 | Notebook didático (`notebooks/`) | | a fazer |
| F1-T11 | Ajuste da foto: recorte e rotação | Pedro + Claude | **feito** |
| F1-T12 | Rastreamento de contorno | Pedro + Claude | **feito** |

### Fase 2 — Visualizador 3D

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F2-T01 | Base visual e layout (+ home + Impeccable) | Pedro + Claude | **feito** (28/10 + polimento Impeccable em 02/11) |
| F2-T02 | Câmera: vistas rápidas e projeção ortográfica | | a fazer |
| F2-T03 | Modos extras de renderização (arestas, flat/suave) | | a fazer |
| F2-T04 | Iluminação controlável (azimute/elevação + sombras) | | a fazer |
| F2-T05 | Shader customizado (GLSL: altura e Fresnel) | | a fazer |
| F2-T06 | Ajudantes visuais (eixos, grade, Box3) | | a fazer |
| F2-T07 | Estatísticas detalhadas do modelo + FPS | | a fazer |
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

### Fase 4 — Produto

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F4-T01 | Autenticação (`/entrar`, `/cadastrar`, Argon2 + JWT) | | a fazer |
| F4-T02 | Créditos (`movimentos_credito`, débito/estorno, `/me`, `/conta`) | Pedro + Claude | **feito** (02/11) |
| F4-T03 | Editor de transformações (salvar versão 4×4 feito; falta pivô/atalhos/undo) | Pedro + Claude | **em andamento** (02/11: salvar versão pronto) |
| F4-T04 | Versões no back (`POST /versoes` e `/restaurar` + seletor no front) | Pedro + Claude | **feito** (02/11) |
| F4-T05 | Outros formatos no download (`.glb`, `.obj`, `.stl`) | Pedro + Claude | **feito** (02/11) |
| F4-T06 | Mapeamento UV e textura (`textura.py`) | | a fazer |
| F4-T07 | Modo UV no visualizador (textura xadrez + atlas 2D) | | a fazer |
| F4-T08 | Storage S3 (MinIO) | | a fazer |

### Fase 5 — Diferenciais e apresentação

| ID | Tarefa | Responsável | Status |
|---|---|---|---|
| F5-T01 | Raio-X do pipeline (7 etapas incluindo Suavizada Taubin) | Pedro + Claude | **feito** (28/10 + 02/11) |
| F5-T02 | LOD (3 níveis de detalhe por distância) | | a fazer |
| F5-T03 | Régua 3D (medição ponto a ponto com raycasting) | | a fazer |
| F5-T04 | Presets na interface | — | **cancelada** (28/10, ADR 0009) |
| F5-T05 | Pincel de correção (`EditorMascara` + `POST /regerar`) | Pedro + Claude | **feito** (02/11) |
| F5-T06 | Visualizador incorporável (`/embed/:id` + copiar `<iframe>`) | | a fazer |
| F5-T07 | Apresentação (roteiro pronto; faltam slides/vídeo do grupo) | todos | em andamento |
