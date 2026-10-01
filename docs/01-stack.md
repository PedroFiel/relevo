# 01 — Stack

Escolhas feitas para **um MVP rápido por um grupo de faculdade**, mantendo a computação gráfica visível e explicável.

## Visão geral

| Camada | Tecnologia | Versão (set/2026) | Papel |
|---|---|---|---|
| Núcleo CG | Python | 3.11+ | linguagem do pipeline |
| | NumPy | 2.x | grade de voxels, álgebra linear, visual hull |
| | OpenCV (`opencv-python-headless`) | 4.x | leitura de imagens, Otsu, morfologia, componentes conexas |
| | SciPy | 1.x | filtro gaussiano 3D no campo de voxels |
| | scikit-image | 0.2x | `measure.marching_cubes` |
| | trimesh | 5.x | malha, normais, suavização, exportação .glb/.obj/.stl |
| | fast-simplification | 0.1.x | decimação por métrica de erro quádrico (usada pelo trimesh) |
| | xatlas | 0.0.x | desdobramento UV (Fase 4) |
| Back-end | FastAPI | 0.14x | API REST, upload multipart, tarefas em segundo plano |
| | Uvicorn | — | servidor ASGI |
| | SQLAlchemy 2 + psycopg 3 | — | ORM e driver PostgreSQL |
| | Alembic | — | migrações do banco |
| | pydantic-settings | — | configuração via `.env` |
| Banco | PostgreSQL | 16 | dados relacionais (+ JSONB para parâmetros/métricas) |
| Storage | Disco local → S3/MinIO | — | arquivos 3D e imagens (S3 na Fase 4) |
| Front-end | React + TypeScript | 19 / 6 | interface |
| | Vite | 8 | build e servidor de dev (com proxy `/api` → FastAPI) |
| | Three.js | 0.18x | renderização WebGL |
| | @react-three/fiber + drei | 9 / 10 | Three.js declarativo + utilitários (OrbitControls, TransformControls, useGLTF) |
| | React Router | 7 | rotas |
| | TanStack Query | 5 | chamadas à API, polling do status do job |
| Qualidade | pytest, ruff | — | testes e lint Python |
| | Vitest + Testing Library, oxlint | — | testes e lint do front |
| | Playwright | — | testes ponta a ponta e screenshots (Fase 3+) |
| Infra | uv (gerenciador Python), npm, Docker Compose, GitHub Actions | — | ambiente e CI |

## Por que assim

**Back-end em Python (FastAPI) e não NestJS** — o pipeline é Python; um back-end só elimina fila, worker separado e
comunicação entre serviços. Ver [ADR 0002](decisoes/0002-fastapi-backend-unico.md).

**Visual hull e não IA** — requisito da disciplina. Ver [ADR 0001](decisoes/0001-visual-hull-sem-ia.md).

**react-three-fiber em vez de Three.js "puro"** — mesma API do Three.js (câmeras, materiais, shaders, raycaster),
mas integrado ao React; a drei traz controles prontos (órbita, gizmo de transformação) que no Three puro dariam
muito código de cola. Os conceitos de CG continuam explícitos (matrizes, materiais, shaders GLSL).

**Tarefas em segundo plano do FastAPI em vez de Celery/Redis** — suficiente para o volume de um trabalho acadêmico.
Ver [ADR 0003](decisoes/0003-jobs-com-background-tasks.md).

**uv** — instala Python e dependências em segundos, com lockfile (`uv.lock`) para todos terem o mesmo ambiente.

## O que NÃO entra (e por quê)

| Ferramenta | Motivo |
|---|---|
| rembg, SAM, MediaPipe, torch, onnxruntime | são IA — proibido no núcleo |
| Open3D | ótima, mas pesada (≈ 400 MB) e redundante com trimesh + scikit-image |
| Blender (bpy) | dependência enorme, difícil em servidor; foge do "fizemos o algoritmo" |
| Redis / Celery | complexidade sem ganho no volume do projeto |
