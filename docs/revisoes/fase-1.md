# Revisão da Fase 1 — Pipeline completo

**Período:** 01/10 – 02/11/2026 · **Participantes:** Pedro · **Branch:** `fase-4/produto-completo`

## Entregue

| ID | Tarefa | Status | Observação |
|---|---|---|---|
| F1-T01 | Configuração e presets | cancelada | ADR 0009: configuração única (resolução 128, 20 mil faces, cor ligada) |
| F1-T02 | Suavização de Taubin | feito | `malha.suavizar` ($\lambda=0,5$, $\nu=0,53$, 10 iterações) + `malha-suave.glb` |
| F1-T03 | Decimação por erro quádrico | feito | Garland–Heckbert para 20 mil faces com *fallback* se perder fechamento |
| F1-T04 | Transformação inversa 3D → pixel | feito | `matriz_grade_para_foto` (3×3 homogênea) + `projetar_vertices` |
| F1-T05 | Cor por vértice | feito | Ponderação por normal $\cos^4\theta$, extensão morfológica e difusão de Laplace |
| F1-T06 | Segmentação robusta | feito | Distância de cor em CIE Lab, morfologia e remoção de halo de sombra |
| F1-T07 | Métricas de qualidade e consistência | feito | IoU em voxels + `iou_malha_<vista>` na resolução original da foto |
| F1-T08 | Intermediários + progresso | feito | Callback `ao_progredir` + `mascara-*.png`, `voxels.glb`, `malha-bruta.glb`, `malha-suave.glb` |
| F1-T09 | Desempenho (`@pytest.mark.lento`) | feito | `test_desempenho_configuracao_padrao_abaixo_de_15s` (~1,1 s na resolução 128) |
| F1-T10 | Notebook didático | feito | `notebooks/01-pipeline-passo-a-passo.ipynb` |
| F1-T11 | Ajuste da foto (recorte e rotação) | feito | `ajuste.py` com matriz 3×3 inversa `M = R⁻¹ · T(x, y)` |
| F1-T12 | Rastreamento de contorno | feito | Suzuki–Abe + versão didática de Moore + simplificação de Douglas–Peucker |

## Métricas

| Métrica | Meta | Resultado |
|---|---|---|
| Testes automatizados do pipeline | 100 % passando | 93 testes em `packages/pipeline/tests/` passando |
| Malha fechada (`is_watertight`) | sempre `True` | `True` em todos os modelos sintéticos e reais (`tenis-01..03`) |
| IoU de reprojeção (`iou_malha_<vista>`) | > 0,90 | 0,91 – 0,98 nas 3 vistas |
| Variação de volume na suavização de Taubin | < 3 % | < 0,8 % (enquanto Laplaciano puro encolhe > 4 %) |
| Tempo na configuração padrão (resolução 128, 20 mil faces) | < 15 s | ~1,1 s |

## Conceitos de CG demonstrados nesta fase
- Segmentação em espaço de cor perceptualmente uniforme (**CIE Lab**) e **morfologia matemática** (abertura, fechamento, erosão e transformada de distância).
- **Seguimento de fronteira** (Suzuki–Abe e vizinhança de Moore) e simplificação poligonal (**Douglas–Peucker**).
- **Transformações afins 2D** em coordenadas homogêneas 3×3 (`ajuste` + `orientacao` + `alinhamento`).
- **CSG implícita** com campos de distância assinada (SDF), **Visual Hull** (Laurentini, 1994) e **cilindro generalizado** (seção transversal comum).
- Extração de isosuperfície por **Marching Cubes** (Lorensen & Cline, 1987), **suavização passa-baixa de Taubin** ($\lambda|\mu$, 1995) e **simplificação quádrica de Garland–Heckbert** (1997).
- Projeção ortográfica inversa, interpolação bilinear e **difusão harmônica discreta** (equação de Laplace no grafo da malha) em espaço linear (IEC 61966-2-1).

## Pronto para a próxima fase?
**Sim.** Fase 1 100 % concluída.
