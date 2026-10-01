# 0001 — Reconstrução por visual hull com 3 vistas, sem IA

**Data:** 2026-09-30 · **Status:** aceita

## Contexto
A primeira versão do projeto usava TripoSR (rede neural) para gerar a malha a partir de 1 foto. A disciplina é de
Computação Gráfica e **não permite IA no núcleo**. Uma foto sozinha não contém informação de profundidade suficiente
sem um modelo aprendido.

## Decisão
O usuário envia **3 fotos em vistas ortogonais** (lateral, topo, frente). Reconstruímos por **visual hull**
(escultura de voxels por silhuetas) + **Marching Cubes**, com segmentação clássica (Otsu + morfologia).

## Alternativas consideradas
- **1 foto + "inflar" a silhueta** — simples, mas gera forma pouco convincente para calçado (sem largura real).
- **Fotogrametria (Structure from Motion + MVS, ex.: COLMAP)** — muito melhor qualidade, mas exige dezenas de fotos,
  calibração e é uma caixa-preta difícil de explicar/implementar no prazo.
- **Visual hull com câmeras calibradas em ângulos livres** — mais flexível, porém exige calibração (tabuleiro de xadrez).
  Fica como extensão opcional.

## Consequências
- Cada etapa é um algoritmo clássico explicável e implementado por nós.
- Concavidades (abertura do pé) não são recuperadas — comunicado ao usuário.
- Qualidade depende do padrão das fotos → guia de fotos e gabarito na tela de upload são parte do produto.
