# 0004 — Cor por vértice no MVP, textura UV na Fase 4

**Data:** 2026-09-30 · **Status:** aceita

## Contexto
Queremos o modelo colorido já no MVP. Textura UV de verdade exige desdobramento (xatlas) e *baking* por texel — mais
complexo.

## Decisão
No MVP (Fase 1) cada **vértice** recebe a cor projetada das fotos (média ponderada por `max(0, n·d)^p`).
Na Fase 4 a mesma regra é aplicada por **texel** num atlas UV.

## Alternativas consideradas
- **UV desde o início** — melhor resultado, atrasa o MVP.
- **Sem cor no MVP** — modelo cinza; perde muito impacto visual na demo.

## Consequências
- A nitidez da cor depende da densidade da malha (decimar demais borra a cor) — preset e-commerce com ~20 mil faces.
- A função de projeção 3D → pixel (F1-T04) é reaproveitada na textura.
