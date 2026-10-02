# tenis-03

- **Tênis:** cano baixo, camurça preta, filetes e entressola dourados, solado preto com detalhes cor de mel
- **Origem das imagens:** imagens de produto (catálogo, 768 px), não fotos do grupo. Fundo quase branco (~245).
- **Medidas reais:** _não medidas_. Comprimento usado: **30 cm, provisório**.
- **Fotos usadas (5 vistas):**

  | Arquivo | Vista | Observação |
  |---|---|---|
  | `lateral.jpg` | lateral | calcanhar à esquerda |
  | `outro_lado.jpg` | outro lado | calcanhar à direita (câmera do outro lado); mostra o "Flight" no calcanhar |
  | `topo.jpg` | de cima | **o par**, em pé (calcanhar em cima) → `ajustes.json` gira 270° (horário) e recorta um tênis |
  | `sola.jpg` | sola | bico à esquerda → o pipeline gira 180° sozinho |
  | `tras.jpg` | traseira | **o par** → `ajustes.json` recorta o tênis da esquerda (o mesmo pé do topo) |

- **`ajustes.json`:** recortes/rotações no formato do editor da página `/fotos` (F3-T13).
- **Não usadas** (guardadas em `out/originais-tenis-03/`): 3/4 do par (oblíqua, com perspectiva e os dois tênis
  sobrepostos — o pipeline só aceita vistas nos eixos) e dois detalhes (cadarço e calcanhar) em que o tênis sai do quadro.
- **Relatório:** `docs/testes/relatorios/2026-10-01-tenis-03.md`

Gerar: `make real TENIS=tenis-03` (ou `make reais`).
