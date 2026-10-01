# CLAUDE.md — Como trabalhar neste repositório

Este arquivo é lido pelo Claude no início de cada sessão. Ele vale também para os integrantes do grupo.

## Contexto em 30 segundos

RELEVO converte **3 fotos** (lateral, de cima, frontal) de um tênis em um **modelo 3D**.
É um trabalho de faculdade de **Computação Gráfica**. Monorepo com 3 frentes:

- `packages/pipeline` — núcleo de CG em Python (segmentação → alinhamento → visual hull → Marching Cubes → malha)
- `apps/api` — FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
- `apps/web` — React + TypeScript + Vite + Three.js via react-three-fiber/drei

## REGRA Nº 1 — Proibido IA no núcleo

O pipeline de conversão **não pode usar IA / redes neurais / modelos treinados**. É requisito da disciplina.

Bibliotecas **proibidas** no projeto: `rembg`, `torch`, `tensorflow`, `onnxruntime`, `transformers`,
`segment-anything`, `mediapipe`, TripoSR, qualquer API de geração 3D (Meshy, Luma, CSM, etc.).

Permitidas: OpenCV (funções clássicas), NumPy, SciPy, scikit-image, trimesh, fast-simplification, xatlas, Pillow.
Na dúvida, pergunte antes de adicionar uma dependência e registre a decisão em `docs/decisoes/`.

## Ritual de toda sessão

1. **Ler** `docs/acompanhamento/STATUS.md` (fase atual e próxima tarefa) e o arquivo da fase em `docs/fases/`.
2. **Confirmar** com o usuário qual tarefa (ID `Fx-Tyy`) será feita.
3. **Criar branch**: `fase-<n>/<id>-<descricao-curta>`, ex.: `fase-1/f1-t01-suavizacao-taubin`.
4. **Implementar** seguindo o "Como fazer" da tarefa. Código e comentários em português; nomes em português sem acento.
5. **Testar**: `make test` e `make lint` precisam passar. Toda tarefa traz seus testes (ver "Testes" da tarefa).
6. **Documentar**:
   - marcar o status da tarefa em `docs/acompanhamento/STATUS.md`;
   - adicionar entrada em `docs/acompanhamento/diario/AAAA-MM-DD.md` (usar `TEMPLATE.md`);
   - se mudou algo visível, adicionar linha em `docs/acompanhamento/CHANGELOG.md`;
   - se tomou uma decisão técnica relevante, criar um ADR em `docs/decisoes/`.
7. **Commit** no padrão Conventional Commits em português: `feat(pipeline): suavizacao de Taubin [F1-T01]`.
8. **Revisão**: abrir PR usando o template; rodar o checklist de `docs/revisoes/checklist-revisao.md`.

## Comandos

```bash
make setup | db-up | migrate | api | web | test | test-py | test-web | lint | poc
uv run pytest packages/pipeline -q          # só o pipeline
uv run relevo-pipeline gerar --help          # CLI do pipeline
cd apps/api && uv run alembic revision --autogenerate -m "mensagem"   # nova migração
```

## Convenções

- **Eixos 3D** (em todo o projeto): `x` = comprimento (calcanhar → bico), `y` = altura (chão → topo), `z` = largura. Unidade: **centímetros**. O modelo sai centrado em x/z e apoiado em y = 0.
- **Vistas**: `lateral` (linhas = y, colunas = x), `topo` (linhas = z, colunas = x), `frente` (linhas = y, colunas = z).
- Python: ruff (linha 100), type hints, funções puras no pipeline (sem I/O dentro das etapas, exceto `cli.py` e `exportar.py`).
- TypeScript: componentes em `src/components`, páginas em `src/pages`, lógica pura em `src/lib` (testável com Vitest).
- Banco: nomes de tabelas/colunas em português, snake_case, plural nas tabelas; toda mudança via Alembic.
- Nunca commitar `.env`, `storage/`, `out/`, fotos pessoais grandes (> 2 MB) — use `samples/` com moderação.
