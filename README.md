# RELEVO

**Três fotos de um tênis → um modelo 3D pronto para usar.** Sem IA: só computação gráfica clássica.

Trabalho em grupo da disciplina de Computação Gráfica (UNASP). SaaS que converte as fotos lateral,
de cima e frontal de um calçado em um modelo 3D (.glb / .obj / .stl) usando **Visual Hull**
(escultura de voxels por silhuetas) + **Marching Cubes**.

```
 fotos (3)  ->  segmentação  ->  alinhamento  ->  visual hull  ->  marching cubes  ->  malha 3D
 OpenCV        Otsu+morfologia   bounding box     voxels NumPy     scikit-image       trimesh
```

## Começando (5 minutos)

Pré-requisitos: **Python 3.11+**, **[uv](https://docs.astral.sh/uv/)**, **Node 22+**, **Docker** (para o banco).

```bash
make setup      # instala dependências Python (uv) e Node (npm) e cria o .env
make db-up      # sobe PostgreSQL + Adminer (http://localhost:8080)
make migrate    # aplica as migrações
make poc        # gera fotos sintéticas e roda o pipeline -> apps/web/public/samples/tenis-exemplo.glb
make api        # API em http://localhost:8000  (documentação interativa em /docs)
make web        # front em http://localhost:5173  -> abra /visualizador
make test       # todos os testes
```

Sem `make` (Windows): veja os comandos equivalentes dentro do `Makefile`.
Guia completo de instalação por sistema operacional: [`docs/07-setup.md`](docs/07-setup.md).

## Estrutura

```
relevo/
├── apps/
│   ├── api/            # back-end FastAPI + SQLAlchemy + Alembic (PostgreSQL)
│   └── web/            # front-end React + TypeScript + Vite + Three.js (react-three-fiber)
├── packages/
│   └── pipeline/       # núcleo de computação gráfica (Python, sem IA)
├── docs/               # TODA a documentação do projeto (comece por docs/README.md)
├── samples/            # fotos de exemplo (sintéticas e reais)
├── docker-compose.yml  # PostgreSQL + Adminer
├── Makefile            # atalhos
└── CLAUDE.md           # regras para as sessões de desenvolvimento com o Claude
```

## Documentação

| Para quê | Onde |
|---|---|
| Entender o produto | [docs/00-visao-geral.md](docs/00-visao-geral.md) |
| Stack e por quê | [docs/01-stack.md](docs/01-stack.md) |
| Arquitetura | [docs/02-arquitetura.md](docs/02-arquitetura.md) |
| O pipeline de CG em detalhe | [docs/03-pipeline-cg.md](docs/03-pipeline-cg.md) |
| Banco de dados | [docs/04-banco-de-dados.md](docs/04-banco-de-dados.md) |
| Contrato da API | [docs/05-api.md](docs/05-api.md) |
| Como fotografar | [docs/06-guia-de-fotos.md](docs/06-guia-de-fotos.md) |
| **Fases e tarefas** | [docs/fases/](docs/fases/README.md) |
| **Onde estamos agora** | [docs/acompanhamento/STATUS.md](docs/acompanhamento/STATUS.md) |
| Testes | [docs/testes/plano-de-testes.md](docs/testes/plano-de-testes.md) |
| Revisões | [docs/revisoes/](docs/revisoes/README.md) |
| Decisões (ADRs) | [docs/decisoes/](docs/decisoes/README.md) |
