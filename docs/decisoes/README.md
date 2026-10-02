# Decisões (ADRs)

*Architecture Decision Records*: um arquivo curto por decisão técnica relevante — contexto, decisão, alternativas e
consequências. Servem para responder "por que fizemos assim?" (inclusive na banca).

Numeração sequencial `NNNN-titulo.md`; nunca apague um ADR — se mudar de ideia, crie outro que o **substitui**.

| Nº | Decisão | Status |
|---|---|---|
| [0001](0001-visual-hull-sem-ia.md) | Reconstrução por visual hull com 3 vistas, sem IA | aceita |
| [0002](0002-fastapi-backend-unico.md) | Back-end único em FastAPI (Python) | aceita |
| [0003](0003-jobs-com-background-tasks.md) | Jobs com BackgroundTasks do FastAPI, sem fila externa | aceita |
| [0004](0004-cor-por-vertice-antes-de-uv.md) | Cor por vértice no MVP, textura UV na Fase 4 | aceita |
| [0005](0005-visual-hull-com-campo-de-distancia.md) | Visual hull com campo de distância assinada (SDF) para gerar a malha | aceita |
| [0006](0006-recorte-zoom-transformacoes-rastreamento-no-mvp.md) | Recorte, zoom, transformações e rastreamento entram no MVP | aceita |
| [0007](0007-vistas-extras-e-secao-transversal.md) | Até 6 vistas, registro por IoU e seção transversal comum | aceita |
| [0008](0008-rastreamento-de-raios-e-selecionar-separar.md) | "Rastrear" = rastreamento de raios; selecionar, separar e mover; estúdio único | aceita |
