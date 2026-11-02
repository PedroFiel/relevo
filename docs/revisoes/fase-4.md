# Revisão da Fase 4 — Produto Completo (SaaS)

**Período:** 02/11/2026 · **Participantes:** Pedro · **Branch:** `fase-4/produto-completo`

## Entregue

| ID | Tarefa | Status | Observação |
|---|---|---|---|
| F4-T01 | Autenticação (`/entrar`, `/cadastrar`, JWT) | feito | `POST /auth/registrar` e `POST /auth/login` (`scrypt` + JWT HS256), isolamento por usuário e páginas `/entrar` e `/cadastrar` |
| F4-T02 | Sistema de créditos e extrato | feito | Tabela `movimentos_credito`, migração `c4a9e12b8f01`, débito com `SELECT ... FOR UPDATE`, estorno automático em falha, `GET /me`, `POST /creditos/recarregar` e página `/conta` |
| F4-T03 | Editor de transformações (pivô, atalhos, Desfazer) | feito | `comporComPivo`, botão "Definir pivô por clique", atalhos `G`/`R`/`S`/`Esc`/`Ctrl+Z`, pilha de Desfazer e botão "Salvar como nova versão" |
| F4-T04 | Versões no back e seletor no front | feito | `POST /modelos/{id}/versoes` e `POST /modelos/{id}/versoes/{numero}/restaurar` + pílulas `v1`, `v2 · 4×4` em `/modelos/:id` |
| F4-T05 | Exportação multi-formato | feito | `GET /versoes/{id}/exportar?formato=glb\|obj\|stl` com cache em `arquivos` + Storage |
| F4-T06 | Mapeamento UV e *texture baking* | feito | `textura.py` com atlas ortográfico de 6 ilhas em $[0, 1]^2$, rasterização RGB e dilatação de costuras |
| F4-T07 | Modo UV no visualizador | feito | Modo `Textura UV` com textura xadrez procedural e diagrama do atlas 2D das 6 ilhas |
| F4-T08 | Storage S3 / MinIO | feito | Serviço `minio` no `docker-compose.yml` + `S3Storage` em `storage.py` (`STORAGE_TIPO=local\|s3`) |

## Métricas

| Métrica | Meta | Resultado |
|---|---|---|
| Testes da API + Pipeline (`pytest`) | 100 % passando | 179 testes passando |
| Migrações Alembic (`compare_metadata`) | 0 divergências | `diferencas == []` entre `models.py` e o esquema migrado |
| Isolamento entre contas | Usuário B não acessa modelo de A | Validado em `test_registro_login_e_isolamento_entre_usuarios` (`404`) |

## Pronto para a próxima fase?
**Sim.** Fase 4 100 % concluída.
