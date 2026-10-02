# 0006 — Recorte, zoom, transformações e rastreamento entram no MVP

**Data:** 2026-10-01 · **Status:** aceita

## Contexto
Em conversa com a professora, o grupo soube que o projeto precisa mostrar os conceitos de **cortar / clipping (recorte),
ampliar / zoom, mexer e aumentar (transformações), rastrear e segmentação**. O plano tinha parte disso espalhado e
tarde: editor de transformações só na Fase 4 (F4-T03), raycasting só na régua (F5-T03), nenhum recorte 2D ou 3D,
nenhum rastreamento de contorno e a segmentação invisível para o usuário. Levantamento das ferramentas parecidas em
[08-ferramentas-similares.md](../08-ferramentas-similares.md).

## Decisão
Antecipar e acrescentar ao **MVP (Fases 1–3)** oito tarefas, todas com algoritmos clássicos implementados e testados:

| Conceito | Tarefa |
|---|---|
| Recorte e rotação da foto (janela, afim 2D) | F1-T11 (pipeline) + F3-T13 (editor no upload) |
| Rastreamento de contorno (Suzuki–Abe / Moore) + Douglas–Peucker | F1-T12 |
| Janela→viewport, zoom, pan, Cohen–Sutherland, Sutherland–Hodgman | F2-T10 |
| Plano de corte 3D (clipping na GPU + tampa com stencil) | F2-T11 |
| Zoom no ponto e cursor rastreado (raycasting) | F2-T12 |
| Mover, girar, aumentar com matriz 4×4 (base do editor) | F2-T13 (F4-T03 fica com pivô/versões) |
| Segmentação + contorno + avisos visíveis | F3-T14 |

## Alternativas consideradas
- **Deixar como estava (Fases 4–5)** — menos trabalho no MVP, mas os conceitos exigidos poderiam não estar prontos na
  avaliação.
- **Só recorte 3D no visualizador** — mais barato, mas não cobre recorte 2D (Cohen–Sutherland / Sutherland–Hodgman),
  que é o conteúdo clássico de "clipping".
- **Usar só o recorte do canvas/WebGL** — funciona, mas não mostra o algoritmo; por isso o recorte de polígonos é
  implementado por nós (F2-T10) e o 3D usa a GPU com a explicação na tela (F2-T11).

## Consequências
- Fases 1–3 crescem ~1 semana no total (estimativas atualizadas em `fases/README.md`).
- API: `POST /modelos` ganha o campo opcional `ajustes`; nada muda no banco (`jobs.parametros` e `versoes.metricas` são
  JSONB).
- O `VisorFoto` (F2-T10) vira peça comum do editor de foto (F3-T13), do resultado (F3-T14) e do pincel (F5-T05).
- "Rastrear" pode ter sido dito no sentido de rasterização ou ray tracing — ambos já estão no plano (ver §4 do
  doc 08). Confirmar com a professora.
