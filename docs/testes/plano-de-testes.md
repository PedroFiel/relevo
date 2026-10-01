# Plano de testes

## Níveis

| Nível | O quê | Ferramenta | Onde | Quando roda |
|---|---|---|---|---|
| Unitário — pipeline | cada etapa de CG isolada (máscara, alinhamento, hull, malha, cor) | pytest | `packages/pipeline/tests/` | todo commit (CI) |
| Unitário — front | funções puras (câmera, matrizes, estatísticas) e componentes | Vitest + Testing Library | `apps/web/src/**/*.test.ts(x)` | todo commit (CI) |
| Integração — API | rotas + banco real de teste + storage temporário | pytest + TestClient + PostgreSQL `relevo_test` | `apps/api/tests/` | todo commit (CI, F3+) |
| Ponta a ponta | upload → processamento → visualizador → download | Playwright | `apps/web/e2e/` | antes de cada fim de fase |
| Visual | screenshots dos modos de render | Playwright | `apps/web/e2e/__screenshots__/` | fim de fase |
| Qualidade da reconstrução | fotos reais com medidas conhecidas | CLI + métricas | `samples/reais/` + `docs/testes/relatorios/` | fim das fases 0, 1, 3, 4 |

## Testes de propriedade (a parte "científica")

Além de "funciona", testamos **propriedades teóricas** dos algoritmos — ótimo material para a apresentação:

| Propriedade | Teste |
|---|---|
| O visual hull contém o objeto real | `test_visual_hull_contem_o_objeto_original` |
| Marching Cubes com borda vazia gera malha fechada | `test_pipeline_ponta_a_ponta` (`is_watertight`) |
| Escala real é preservada | comprimento = 28 cm ± 1 |
| Taubin não encolhe (Laplaciano encolhe) | F1-T02 |
| Decimação mantém a forma | erro médio < 0,5 mm (F1-T03) |
| Reprojeção bate com as silhuetas | IoU > 0,90 (F1-T07) |
| Matriz com pivô = T(p)·R·S·T(−p) | F4-T03 |

## Conjunto de fotos de referência

```
samples/
├── sintetico/          gerado pelo código (determinístico) — usado nos testes automáticos
└── reais/
    ├── tenis-01/       lateral.jpg, topo.jpg, frente.jpg, info.md (medidas reais em cm, cor, fundo usado)
    └── tenis-02/
```
Regra: fotos reais com no máximo ~1600 px no maior lado e < 1 MB cada.

## Métricas registradas por execução

`dims_voxels`, `voxels_ocupados`, `vertices`, `faces`, `fechada`, `dimensoes_cm`, `tempos_s` (já existem) +
`iou_vistas`, `erro_medio_mm`, `avisos` (Fase 1). Em relatórios de fotos reais, adicionar **erro dimensional**:
`|dimensão do modelo − medida real| / medida real`.

## Critérios de aprovação por fase

| Fase | Critério |
|---|---|
| 0 | 1 tênis real reconhecível; CI verde |
| 1 | IoU > 0,90 no sintético; erro dimensional < 5 % nos reais; < 10 s |
| 2 | todos os modos funcionando; testes visuais gerados |
| 3 | E2E do MVP passando; 2 tênis reais via site |
| 4 | fluxo com conta, créditos, edição e exportações testado |
| 5 | demo do Raio-X ensaiada sem falhas |

## Como registrar

- Testes automatizados: o próprio CI é o registro.
- Testes com fotos reais e manuais: um arquivo em `docs/testes/relatorios/` a partir do `TEMPLATE.md`.
