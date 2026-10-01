# 0002 — Back-end único em FastAPI (Python)

**Data:** 2026-09-30 · **Status:** aceita

## Contexto
O plano original era NestJS (Node) para a API + workers Python para o pipeline. O pipeline é Python
obrigatoriamente (OpenCV, scikit-image, trimesh).

## Decisão
API em **FastAPI**, no mesmo processo/linguagem do pipeline, que é importado como pacote (`relevo-pipeline`).

## Alternativas consideradas
- **NestJS + worker Python + fila (Redis/BullMQ)** — arquitetura "de mercado", mas dobra o setup, exige contrato entre
  serviços e uma fila; atrasa o MVP.
- **Express + `child_process` chamando a CLI Python** — simples, mas frágil (parsing de saída, erros, progresso).

## Consequências
- Um só ambiente (uv), um só lockfile, testes de integração diretos.
- Documentação automática da API em `/docs`.
- Se no futuro o processamento precisar escalar, o pipeline já é um pacote isolado e pode ir para um worker separado.
