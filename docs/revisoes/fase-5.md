# Revisão da Fase 5 — Diferenciais de CG e Entrega Final

**Período:** 28/10 – 02/11/2026 · **Participantes:** Pedro · **Branch:** `fase-4/produto-completo`

## Entregue

| ID | Tarefa | Status | Observação |
|---|---|---|---|
| F5-T01 | Raio-X do pipeline (7 etapas) | feito | Fotos → Silhuetas → Voxels (`InstancedMesh`) → Malha bruta → Suavizada (Taubin) → Decimada → Final + modo Apresentação |
| F5-T02 | Níveis de detalhe (LOD) | feito | `malha.gerar_lods` (`100 %`, `25 %`, `5 %`) + `nivelLodPorDistancia` e indicador ao vivo no visualizador |
| F5-T03 | Régua 3D ponto a ponto | feito | Aba `Régua 3D` no visualizador com *raycasting* de 2 pontos na superfície, segmento 3D e distância em `cm` e `mm` |
| F5-T04 | Presets na interface | cancelada | ADR 0009: configuração única sem jargão técnico para o lojista |
| F5-T05 | Pincel de correção da máscara | feito | `EditorMascara.tsx` (pincel/borracha em `<canvas>`) + `POST /modelos/{id}/regerar` + `mascaras_prontas` no pipeline |
| F5-T06 | Visualizador incorporável (`/embed/:id`) | feito | `GET /publico/{id}`, `GET /publico/{id}/glb`, página `/embed/:id` e botão "Incorporar (`<iframe>`)" com cópia de HTML |
| F5-T07 | Apresentação | em andamento (grupo) | Roteiro completo e perguntas da banca em `docs/apresentacao/roteiro.md`; faltam apenas slides/vídeo do grupo |

## Lições aprendidas do projeto
- **Computação gráfica clássica explicável:** separar claramente cada etapa geométrica (CIE Lab + morfologia → Suzuki–Abe/Moore + Douglas–Peucker → alinhamento afim → SDF + Visual Hull + seção transversal → Marching Cubes → Taubin → Garland–Heckbert → projeção de cor e atlas UV de 6 ilhas) permitiu transformar os próprios artefatos intermediários na principal ferramenta didática do sistema (o **Raio-X do pipeline**).
- **Verificação ponta a ponta real:** manter testes que exercitam o banco PostgreSQL real, o pipeline numérico e o navegador headless (Playwright com SwiftShader) evitou regressões entre backend e frontend.
