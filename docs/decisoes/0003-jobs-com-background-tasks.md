# 0003 — Jobs com BackgroundTasks do FastAPI, sem fila externa

**Data:** 2026-09-30 · **Status:** aceita

## Contexto
Gerar o modelo leva de 1 a 10 segundos; a requisição de upload não deve esperar. O volume é de um trabalho acadêmico
(poucos usuários simultâneos).

## Decisão
`POST /modelos` responde 202 e agenda `executar_job` com `BackgroundTasks`. O progresso é gravado na tabela `jobs`
e o front faz *polling* a cada 1 s.

## Alternativas consideradas
- **Celery/RQ + Redis** — robusto (retentativas, vários workers), mas mais infraestrutura.
- **WebSocket/SSE para progresso** — mais elegante que polling; pode entrar depois sem mudar o banco.

## Consequências
- Se o servidor reiniciar no meio, o job se perde → no *startup* marcamos jobs `processando` como `erro`.
- Processamento pesado roda no mesmo processo da API; aceitável para o volume. Limitar resolução máxima (192).
