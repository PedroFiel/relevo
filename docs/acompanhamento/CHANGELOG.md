# Changelog

Mudanças visíveis para quem usa ou avalia o projeto. Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado (01/10/2026)
- **Cor por vértice:** o modelo agora sai colorido, com as cores das fotos projetadas sobre a malha (`COR_0` no .glb,
  em espaço linear). [F1-T05]
- Visualizador abre qualquer `.glb` do computador, tem seletor de modelos e mostra a cor do modelo no modo Sólido. [F2-T08]
- `make real`: gera o modelo do `samples/reais/tenis-01` em resolução 256 e abre no visualizador.

### Corrigido (01/10/2026)
- **Segmentação:** tênis escuro com solado branco em fundo claro perdia o solado (o Otsu usava só o brilho). Agora a
  máscara usa a distância de cor ao fundo (Lab) e remove a sombra de contato. [F1-T06, parcial]

### Adicionado
- Pipeline de prova de conceito sem IA: segmentação (Otsu + morfologia), alinhamento das 3 vistas, visual hull em
  voxels, Marching Cubes, exportação .glb/.obj/.stl em escala real. CLI `relevo-pipeline`. [F0-T03]
- Gerador de fotos sintéticas de um tênis para testes. [F0-T04]
- API FastAPI com `/health` e `/health/db`; Alembic configurado. [F0-T05]
- PostgreSQL + Adminer via Docker Compose. [F0-T06]
- Front React + Three.js com visualizador (sólido, wireframe, normais). [F0-T07]
- Documentação: visão, stack, arquitetura, pipeline de CG, banco, API, guia de fotos, setup, 6 fases detalhadas,
  acompanhamento, testes, revisões e ADRs.
