# Changelog

Mudanças visíveis para quem usa ou avalia o projeto. Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- Pipeline de prova de conceito sem IA: segmentação (Otsu + morfologia), alinhamento das 3 vistas, visual hull em
  voxels, Marching Cubes, exportação .glb/.obj/.stl em escala real. CLI `relevo-pipeline`. [F0-T03]
- Gerador de fotos sintéticas de um tênis para testes. [F0-T04]
- API FastAPI com `/health` e `/health/db`; Alembic configurado. [F0-T05]
- PostgreSQL + Adminer via Docker Compose. [F0-T06]
- Front React + Three.js com visualizador (sólido, wireframe, normais). [F0-T07]
- Documentação: visão, stack, arquitetura, pipeline de CG, banco, API, guia de fotos, setup, 6 fases detalhadas,
  acompanhamento, testes, revisões e ADRs.
