# Relatório de teste — Primeiras imagens reais (2026-10-01)

**Fase / tarefa:** F0-T10 (parcial) · **Quem:** Pedro + Claude · **Versão (commit):** `9d66837` + branch `fase-1/f1-t05-t06-cor-e-segmentacao`

## Objetivo
Verificar se o pipeline gera um modelo reconhecível a partir de imagens reais, no caso mais difícil previsto:
**tênis escuro com solado branco/vermelho em fundo claro**.

## Entradas

| Amostra | Medidas reais (C × A × L cm) | Cor / fundo | Observações da foto |
|---|---|---|---|
| tenis-01 | _não medido_ (30 cm provisório) | preto + solado branco e vermelho / cinza claro liso | **Imagens de catálogo**, não fotos do grupo. Frente com perspectiva e moldura escura de ~3 px |

## Comando

```bash
make real            # = relevo-pipeline gerar ... --comprimento-cm 30 --resolucao 256
```

## Resultados

| Amostra | Faces | Fechada | Dimensões modelo (cm) | Erro dimensional | IoU (L/T/F) | Tempo (s) | Reconhecível? |
|---|---|---|---|---|---|---|---|
| tenis-01 (antes: Otsu, res. 128) | 47 mil | sim | 29,9 × 13,6 × 11,0 | n/d | n/d | 0,2 | **Não** — sem solado, parecia sapato social |
| tenis-01 (depois: cor ao fundo, res. 256) | 248 mil | sim | 30,0 × 15,0 × 11,4 | n/d (sem medida real) | n/d (F1-T07) | ~1,5 | **Sim**, com cores e detalhes |

Máscaras (depois): `assets/2026-10-01-tenis-01-mascaras.png` (lateral, topo, frente).

## Problemas encontrados → ações

| Problema | Causa provável | Ação (tarefa) |
|---|---|---|
| Solado branco sumia das máscaras | Otsu separa por brilho; branco ≈ fundo claro | Trocado por distância de cor ao fundo (F1-T06, feito) |
| Modelo todo cinza no visualizador | Material "Sólido" tinha cor fixa e o pipeline não gerava cor | Cor por vértice (F1-T05) + visualizador usa `COLOR_0` |
| Cores lavadas (vermelho → rosa) | `COLOR_0` do glTF é linear; gravávamos sRGB | Conversão sRGB→linear em `cor.py` |
| Sombra de contato virava "objeto" | Faixa escura sob o solado | Abertura morfológica proporcional à imagem |
| Forma "quadrada" (frente do tênis) | Limite do visual hull: só silhuetas; a frente tem perspectiva | Documentado; melhora com foto frontal ortográfica (guia de fotos) |
| Erro dimensional não medido | Sem tênis físico | **Pendente:** fotografar um tênis do grupo e medir com fita |
| Faltam avisos de qualidade da máscara | — | F1-T06 (restante) |

## Conclusão
**Aprovado parcialmente.** O pipeline gera um modelo reconhecível e colorido no caso mais difícil de segmentação.
A F0-T10 só fecha com fotos próprias de 2 tênis (um claro, um escuro) e a medida real para calcular o erro dimensional.
