# 04 — Banco de dados

PostgreSQL 16. Toda mudança de esquema via **Alembic** (`apps/api/migrations`). Tabelas no plural, snake_case,
chaves primárias `UUID`, datas `timestamptz`.

Fase em que cada tabela nasce: **F3** = MVP, **F4** = produto.

## Diagrama ER

```mermaid
erDiagram
    usuarios ||--o{ modelos : possui
    usuarios ||--o{ movimentos_credito : tem
    modelos ||--|{ imagens : "tem 2 a 6"
    modelos ||--o{ jobs : gera
    modelos ||--o{ versoes : tem
    jobs ||--o| versoes : produz
    versoes ||--o{ arquivos : contem

    usuarios {
        uuid id PK
        text nome
        text email UK
        text senha_hash "F4 (nulo no MVP)"
        int creditos
        timestamptz criado_em
    }
    modelos {
        uuid id PK
        uuid usuario_id FK
        text nome
        numeric comprimento_cm
        text status "rascunho|processando|pronto|erro"
        int versao_atual
        timestamptz criado_em
        timestamptz atualizado_em
    }
    imagens {
        uuid id PK
        uuid modelo_id FK
        text vista "lateral|topo|frente|outro_lado|sola|tras"
        text caminho
        int largura_px
        int altura_px
        int tamanho_bytes
        timestamptz criado_em
    }
    jobs {
        uuid id PK
        uuid modelo_id FK
        text status "pendente|processando|concluido|erro"
        text etapa_atual
        int progresso "0-100"
        jsonb parametros
        jsonb metricas
        text erro
        timestamptz iniciado_em
        timestamptz finalizado_em
        timestamptz criado_em
    }
    versoes {
        uuid id PK
        uuid modelo_id FK
        uuid job_id FK
        int numero
        jsonb parametros
        jsonb metricas "resultado exibido"
        jsonb transformacao "matriz 4x4 (F4)"
        timestamptz criado_em
    }
    arquivos {
        uuid id PK
        uuid versao_id FK
        text tipo "glb|obj|stl|textura|mascara|etapa"
        text nome
        text caminho
        int tamanho_bytes
        timestamptz criado_em
    }
    movimentos_credito {
        uuid id PK
        uuid usuario_id FK
        int quantidade "negativo = consumo"
        text motivo
        uuid job_id FK
        timestamptz criado_em
    }
```

## Tabelas

### `usuarios` (F3; autenticação em F4)
No MVP existe um usuário **demo** criado por *seed* na migração; todas as requisições usam ele:
id fixo `00000000-0000-0000-0000-000000000001`, e-mail `demo@relevo.local` (constante `USUARIO_DEMO_ID` em
`relevo_api/models.py`). `creditos` começa em 0 e só passa a valer na F4.
Na F4 entram `senha_hash` (Argon2) e login JWT. `email` único.

### `modelos` (F3)
O "projeto" do usuário: um calçado. `comprimento_cm` é o tamanho real informado (escala do modelo).
`versao_atual` aponta o número da versão exibida (nulo até a primeira versão ficar pronta).
`status` começa em `rascunho`; `CHECK comprimento_cm BETWEEN 5 AND 60` (mesma faixa da API).
`atualizado_em` é renovado pelo SQLAlchemy a cada `UPDATE` (ordena "Meus modelos").

### `imagens` (F3)
Uma linha por foto enviada (2 a 6 por modelo: `lateral` e `topo` obrigatórias, as outras opcionais — ADR 0007).
**Restrição:** `UNIQUE (modelo_id, vista)`;
`CHECK vista IN ('lateral','topo','frente','outro_lado','sola','tras')` — a mesma lista de
`packages/pipeline/src/relevo_pipeline/vistas.py` (um teste garante que as duas não se separem).
A obrigatoriedade de `lateral`/`topo` é validada na API (F3-T03), não no banco.
O arquivo fica no Storage; aqui só o caminho e metadados.

### `jobs` (F3)
Cada execução do pipeline. O worker atualiza `etapa_atual` e `progresso` a cada etapa (o front faz *polling*).
- `parametros` (JSONB): `{"resolucao": 128, "suavizacao": 10, "faces_alvo": 20000, "preset": "ecommerce"}`
- `metricas` (JSONB): registro da **execução** (tempo de cada etapa, resolução usada) — gravado também quando
  o job dá erro, para depurar.
- `progresso` com `CHECK progresso BETWEEN 0 AND 100`.
Índice em `(status)` para achar jobs travados no *startup*.

### `versoes` (F3)
Cada resultado aceito. `UNIQUE (modelo_id, numero)`. Na F4, editar escala/rotação/pivô cria nova versão com a
**matriz de transformação homogênea 4×4** em `transformacao` (lista de 16 números, ordem *column-major* como no Three.js).
- `metricas` (JSONB): o **resultado** exibido — `ResultadoPipeline.metricas` (faces, dimensões, fechada, IoU, avisos,
  contornos, ajustes). É o que `GET /modelos/{id}` devolve em `versao.metricas` (ADR 0006, F3-T14).
- `job_id` é opcional: a versão criada por edição (F4) não roda o pipeline. Apagar o job deixa `job_id` nulo.

### `arquivos` (F3)
Arquivos de uma versão: `.glb` principal, exportações `.obj/.stl` (F4), textura (F4), máscaras e malhas
intermediárias para o Raio-X (F5). `nivel_lod` (smallint, nulo = completo) entra na F5.

### `movimentos_credito` (F4)
Extrato de créditos. Saldo = `usuarios.creditos` (atualizado na mesma transação do movimento).

## Regras de integridade

- `ON DELETE CASCADE` de `modelos` para `imagens`, `jobs`, `versoes`; de `versoes` para `arquivos`.
- `versoes.job_id` usa `ON DELETE SET NULL` (a versão sobrevive ao job que a gerou).
- Apagar um modelo **também apaga os arquivos no Storage** (feito pela aplicação, não pelo banco).
- Status sempre via `CHECK` (ou `Enum` do SQLAlchemy com `native_enum=False`).

## Consultas importantes

```sql
-- Biblioteca "Meus modelos" com a versão atual e o .glb
SELECT m.id, m.nome, m.status, v.numero, a.caminho
FROM modelos m
LEFT JOIN versoes v ON v.modelo_id = m.id AND v.numero = m.versao_atual
LEFT JOIN arquivos a ON a.versao_id = v.id AND a.tipo = 'glb'
WHERE m.usuario_id = :usuario
ORDER BY m.atualizado_em DESC;

-- Jobs travados (servidor reiniciou no meio do processamento)
UPDATE jobs SET status = 'erro', erro = 'interrompido' WHERE status = 'processando';
```
