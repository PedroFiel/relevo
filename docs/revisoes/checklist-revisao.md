# Checklist de revisão de código

Marque cada item no comentário do PR. Itens **[bloqueia]** impedem o merge.

## Escopo
- [ ] **[bloqueia]** O PR resolve a tarefa indicada (ID `Fx-Tyy` no título) e só ela
- [ ] Critério de **Aceite** da tarefa verificado (como?)

## Regra do projeto
- [ ] **[bloqueia]** Nenhuma dependência de IA (rembg, torch, onnxruntime, modelos treinados, APIs de geração 3D)
- [ ] Dependência nova justificada (e ADR se for relevante)

## Correção
- [ ] **[bloqueia]** `make test` e `make lint` passando (CI verde)
- [ ] **[bloqueia]** Testes novos cobrindo a tarefa (casos felizes e de erro)
- [ ] Convenção de eixos respeitada (x comprimento, y altura, z largura, cm)
- [ ] Erros tratados com mensagem útil ao usuário (em português)
- [ ] Sem segredos, `.env`, `storage/` ou fotos grandes no commit

## Pipeline (se mexeu em `packages/pipeline`)
- [ ] Etapas continuam funções puras (sem I/O fora de `cli.py`/`exportar.py`)
- [ ] Operações vetorizadas com NumPy (sem laços Python por voxel/vértice)
- [ ] Métricas novas aparecem em `ResultadoPipeline.metricas`
- [ ] `docs/03-pipeline-cg.md` atualizado se o algoritmo mudou

## Back / banco (se mexeu em `apps/api`)
- [ ] Mudança de esquema tem migração Alembic revisada à mão; `downgrade` funciona
- [ ] Validação de entrada (tamanho, tipo, faixa de valores)
- [ ] Usuário só acessa os próprios recursos (F4+)
- [ ] `docs/05-api.md` / `docs/04-banco-de-dados.md` atualizados

## Front (se mexeu em `apps/web`)
- [ ] Lógica em `src/lib` com teste; componentes enxutos
- [ ] Funciona em 375 px de largura
- [ ] Sem *re-render* que recarrega o modelo à toa (materiais/geometrias em `useMemo`, liberar com `dispose`)
- [ ] Estados de carregamento e erro tratados

## Documentação
- [ ] STATUS atualizado, entrada no diário, CHANGELOG (se visível)
- [ ] Comentários explicam o **porquê** e o conceito de CG quando houver
