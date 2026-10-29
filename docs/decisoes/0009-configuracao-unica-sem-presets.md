# 0009 — Configuração única de geração, sem presets nem escolhas técnicas

**Data:** 2026-10-28 · **Status:** aceita

## Contexto
O plano previa **presets de destino** (F1-T01 no pipeline e F5-T04 na interface): "e-commerce" (~20 mil faces,
colorido), "jogo" (~5 mil faces, *low poly*) e "impressão 3D" (sem decimação, sem cor, `.stl`). Enquanto eles não
existiam, o `/novo` ganhou uma escolha provisória de **"Qualidade"** (resolução 96/128/192).

Revendo com o produto pronto (MVP, 28/10):
- O RELEVO é para **lojistas de tênis** vendendo online (CLAUDE.md §1). "Jogo" e "impressão 3D" estão fora desse foco.
- O modelo padrão já é um bom meio-termo: 20 mil faces, ~0,5 MB, colorido, fechado — abre rápido até no celular.
  Um preset "leve" quase não mudaria a experiência.
- Escolher preset ou resolução é uma decisão técnica que o lojista não sabe tomar — vai contra o valor
  **Acessibilidade** ("o usuário não precisa saber nada de 3D").
- O pipeline leva ~1–2 s; não há tempo a economizar com uma "qualidade rápida".

## Decisão
**Uma configuração só**, a de loja virtual: resolução 128, decimação para ~20 mil faces, cor por vértice, `.glb`.
O lojista não escolhe nada técnico — só envia as fotos e informa o tamanho em cm. A F1-T01 e a F5-T04 ficam
**canceladas** e a escolha de "Qualidade" sai do `/novo`. Outros formatos (`.obj`, `.stl`) continuam possíveis como
**opção no download** (F4-T05), sem mudar como o modelo é gerado.

## Alternativas consideradas
- **Três presets (e-commerce, jogo, impressão 3D)** — cobre mais usos; mas dois deles fogem do foco e todos pedem uma
  escolha que o lojista não entende.
- **Presets voltados à loja (página do produto, celular, impressão)** — mais perto do foco; mas o modelo padrão já é
  leve, a diferença seria pequena e a escolha continuaria técnica.
- **Presets por tipo de tênis (cano alto, corrida…)** — sem efeito: o visual hull reconstrói qualquer formato a partir
  das silhuetas; o tipo do tênis não muda nenhum parâmetro.

## Consequências
- Fluxo mais simples: fotos → tamanho → modelo. Menos código (sem `ConfigPipeline`/`PRESETS`) e menos testes.
- A API e a CLI continuam aceitando `resolucao` e `faces_alvo` (uso de desenvolvimento e testes); o site não os envia.
- Se um dia aparecer um destino real com outra necessidade (ex.: realidade aumentada no celular), reabrir com nova ADR.
- A suavização de Taubin (F1-T02) segue no plano como refinamento, sempre ligada, sem virar opção.
