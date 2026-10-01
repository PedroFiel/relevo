# tenis-01

- **Tênis:** cano baixo, camurça preta, detalhes vermelhos, entressola branca e solado vermelho
- **Origem das imagens:** imagens de produto (catálogo), não fotos tiradas pelo grupo — fundo cinza claro uniforme
  (~236), luz de estúdio. Servem para validar a segmentação com solado branco em fundo claro.
- **Medidas reais:** _não medidas_ (não temos o par físico). O comprimento usado no pipeline é **30 cm, provisório**.
  Quando houver um tênis em mãos, medir com fita (calcanhar → bico, largura, altura) e preencher aqui.
- **Vistas:** lateral e topo com calcanhar à esquerda e bico à direita; frente olhando o bico
  (tem uma moldura escura de ~3 px nas bordas, que a segmentação ignora).
- **Originais (maiores):** guardados localmente em `out/originais-tenis-01/`; aqui estão reduzidos a 1600 px.

Gerar o modelo: `make real` (ou `make real CM=28.5`).
