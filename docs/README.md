# Documentação do RELEVO

Esta pasta é a **fonte da verdade** do projeto: o que vamos construir, como, em que ordem, e onde estamos.

## Mapa

```
docs/
├── 00-visao-geral.md        o produto: problema, solução, público, escopo, fora de escopo
├── 01-stack.md              tecnologias escolhidas e por quê
├── 02-arquitetura.md        como as peças conversam (diagramas)
├── 03-pipeline-cg.md        o coração: cada etapa de CG, a teoria e onde está no código
├── 04-banco-de-dados.md     entidades, relacionamentos, diagrama ER
├── 05-api.md                contrato dos endpoints
├── 06-guia-de-fotos.md      como o usuário deve fotografar (vira tela de ajuda no app)
├── 07-setup.md              instalação passo a passo (Windows / macOS / Linux)
├── fases/                   o plano: 6 fases, cada tarefa com ID, "como fazer", testes e aceite
├── acompanhamento/          STATUS (painel), CHANGELOG, diário de bordo das sessões
├── testes/                  plano de testes, relatórios de testes com fotos reais
├── revisoes/                checklist de revisão, revisões de fim de fase
└── decisoes/                ADRs: registro das decisões técnicas
```

## Fluxo de trabalho (como usamos estes documentos)

```
STATUS.md  ->  escolhe a próxima tarefa (Fx-Tyy)  ->  lê a tarefa em fases/fase-x.md
    ->  implementa + testa  ->  atualiza STATUS + diário (+ CHANGELOG / ADR se for o caso)
    ->  PR com template  ->  revisão com checklist  ->  merge
fim da fase  ->  revisoes/fase-x.md (demo, métricas, o que ficou)  ->  próxima fase
```

## Como pedir ao Claude

Exemplos de pedidos que funcionam bem numa sessão:

- "Leia o STATUS e me diga qual é a próxima tarefa."
- "Execute a tarefa F1-T01 seguindo o documento da fase."
- "Revise as mudanças da branch atual com o checklist de revisão."
- "Feche a Fase 1: gere a revisão de fase com as métricas dos testes."
- "Rode o pipeline nas fotos de `samples/reais/tenis-01` e registre um relatório de teste."
