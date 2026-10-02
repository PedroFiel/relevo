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
| `outro_lado`, `sola`, `tras` | arquivo | não | JPEG/PNG, ≤ 10 MB — vistas extras (ADR 0007) |
| `resolucao` | inteiro | não | 64–192 (padrão 128) |
| `ajustes` | texto (JSON) | não | por vista: `{"topo": {"rotacao_graus": 90, "recorte": [x, y, largura, altura]}}` — rotação ∈ {0, 90, 180, 270}; recorte em pixels da foto **já girada**, dentro dela e ≥ 64 px (F3-T13) |

Resposta **202**: `{"modelo_id": "uuid", "job_id": "uuid"}`
Erros: 400 (arquivo inválido), 413 (muito grande), 422 (`ajustes` inválido), 402 (sem créditos — F4).

### `GET /modelos` — lista do usuário
**200**: `[{"id", "nome", "status", "versao_atual", "miniatura_url", "atualizado_em"}]`

### `GET /modelos/{id}` — detalhe
**200**:
```json
{
  "id": "…", "nome": "Tênis azul", "status": "pronto", "comprimento_cm": 28,
  "imagens": [{"vista": "lateral", "url": "/arquivos/…"}],
  "versao": {"numero": 1,
             "metricas": {"faces": 19876, "fechada": true, "dimensoes_cm": [28, 10.5, 9.8],
                          "avisos": ["Giramos a foto de topo em 90° …"],
                          "contornos": {"lateral": [[412, 300], [415, 298], "…"]},
                          "ajustes": {"topo": {"rotacao_graus": 90, "recorte": null, "matriz": [[…], […], […]]}}},
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

## Desenvolvimento (já existe)

### `POST /amostras/{tenis}/gerar` — regera um tênis de `samples/reais/` (estúdio, ADR 0008)
JSON: `{"ajustes": {"topo": {"rotacao_graus": 270, "recorte": [x, y, w, h]}}, "comprimento_cm": 30, "resolucao": 256}`.
Roda o pipeline com as fotos da pasta e os ajustes; se der certo, grava `samples/reais/{tenis}/ajustes.json` e publica
`apps/web/public/samples/{tenis}.glb` + `/{tenis}/fotos` + `/{tenis}/metricas.json`.
**200**: métricas (sem os contornos) + `versao` (para o front evitar o cache). **404**: nome fora de `tenis-NN` ou pasta
inexistente. **422**: o pipeline recusou (ex.: "O recorte ficou pequeno demais… Desenhe um retângulo maior").
Usado pelo botão "Aplicar e gerar o 3D" da página `/fotos` (o Vite repassa `/api` para a porta 8000: rode `make api`).
