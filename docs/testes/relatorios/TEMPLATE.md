# Relatório de teste — <título> (AAAA-MM-DD)

**Fase / tarefa:** Fx-Tyy · **Quem:** · **Versão (commit):** `abc1234`

## Objetivo
O que este teste quer verificar.

## Entradas

| Amostra | Medidas reais (C × A × L cm) | Cor / fundo | Observações da foto |
|---|---|---|---|
| tenis-01 | 27,5 × 11 × 10 | preto / cartolina branca | |

## Comando

```bash
uv run relevo-pipeline gerar --lateral ... --topo ... --frente ... --comprimento-cm 27.5 --saida out/x.glb --debug out/x
```

## Resultados

| Amostra | Faces | Fechada | Dimensões modelo (cm) | Erro dimensional | IoU (L/T/F) | Tempo (s) | Reconhecível? |
|---|---|---|---|---|---|---|---|
| tenis-01 | | | | | | | |

Prints (salvar em `docs/testes/relatorios/assets/`): máscaras, modelo em 3 ângulos.

## Problemas encontrados → ações

| Problema | Causa provável | Ação (tarefa) |
|---|---|---|
| | | |

## Conclusão
Aprovado / reprovado e por quê.
