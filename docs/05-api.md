# 05 — Contrato da API

Base: `http://localhost:8000` (no front, via proxy: `/api/...`). Documentação interativa gerada pelo FastAPI em
**`/docs`** (Swagger) — ela é sempre a referência final; este arquivo é o contrato combinado entre front e back.

Formato de erro padrão: `{"detail": "mensagem legível"}` com status HTTP adequado.

## Saúde (F0 — pronto)

| Método | Rota | Resposta |
|---|---|---|
| GET | `/health` | `{"status": "ok", "pipeline": "0.1.0"}` |
| GET | `/health/db` | `{"banco": "ok" \| "indisponivel"}` |

## Modelos (F3)

### `POST /modelos` — cria modelo e dispara a geração
`multipart/form-data`:

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `nome` | texto | sim | 1–80 caracteres |
| `comprimento_cm` | número | sim | 5–60 |
| `lateral` | arquivo | sim | JPEG/PNG, ≤ 10 MB |
| `topo` | arquivo | sim | JPEG/PNG, ≤ 10 MB |
| `frente` | arquivo | não | JPEG/PNG, ≤ 10 MB |
| `resolucao` | inteiro | não | 64–192 (padrão 128) |

Resposta **202**: `{"modelo_id": "uuid", "job_id": "uuid"}`
Erros: 400 (arquivo inválido), 413 (muito grande), 402 (sem créditos — F4).

### `GET /modelos` — lista do usuário
**200**: `[{"id", "nome", "status", "versao_atual", "miniatura_url", "atualizado_em"}]`

### `GET /modelos/{id}` — detalhe
**200**:
```json
{
  "id": "…", "nome": "Tênis azul", "status": "pronto", "comprimento_cm": 28,
  "imagens": [{"vista": "lateral", "url": "/arquivos/…"}],
  "versao": {"numero": 1, "metricas": {"faces": 19876, "fechada": true, "dimensoes_cm": [28, 10.5, 9.8]},
             "arquivos": [{"tipo": "glb", "url": "/arquivos/…/download"}]}
}
```

### `DELETE /modelos/{id}` — remove modelo e arquivos → **204**

## Jobs (F3)

### `GET /jobs/{id}`
**200**:
```json
{"id": "…", "status": "processando", "etapa_atual": "visual_hull", "progresso": 50,
 "etapas": ["segmentacao", "alinhamento", "visual_hull", "marching_cubes", "suavizacao", "decimacao", "cor", "exportacao"],
 "erro": null}
```

## Arquivos (F3)

### `GET /arquivos/{id}/download` → o binário com `Content-Type` correto
(`model/gltf-binary`, `model/obj`, `model/stl`, `image/png`).

## Fase 4

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/registrar` | `{nome, email, senha}` → 201 |
| POST | `/auth/login` | `{email, senha}` → `{access_token}` (JWT) |
| GET | `/me` | usuário + saldo de créditos |
| POST | `/modelos/{id}/versoes` | `{transformacao: number[16]}` → nova versão com a matriz aplicada |
| GET | `/versoes/{id}/exportar?formato=obj\|stl\|glb` | gera/baixa o formato |

## Fase 5

| Método | Rota | Descrição |
|---|---|---|
| GET | `/versoes/{id}/etapas` | URLs dos intermediários para o Raio-X |
| POST | `/modelos/{id}/regerar` | regerar com outros parâmetros/preset (`{preset, resolucao, mascaras_corrigidas?}`) |
| GET | `/publico/{id}` | dados para o visualizador incorporável (sem login) |
