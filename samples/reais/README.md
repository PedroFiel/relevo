# Fotos reais

Uma pasta por calçado: `tenis-01/`, `tenis-02/`, ...

```
tenis-03/
├── lateral.jpg      # obrigatória: calcanhar à esquerda, bico à direita
├── topo.jpg         # obrigatória: vista de cima (se vier em pé, o pipeline gira)
├── frente.jpg       # recomendada: olhando o bico
├── tras.jpg         # opcional: olhando o calcanhar
├── outro_lado.jpg   # opcional: o outro lado (calcanhar à direita)
├── sola.jpg         # opcional: de baixo
├── ajustes.json     # opcional: recorte/rotação por vista (gerado pelo editor em /fotos)
└── info.md          # medidas reais (comprimento × altura × largura em cm), cor, fundo, celular usado
```

O nome do arquivo é a vista (`.jpg`, `.jpeg` ou `.png`). Um tênis por foto: se só houver a foto do par, recorte com o
editor da página `/fotos` (botão "Ajustar") e salve o `ajustes.json` aqui.

Reduza para ~1600 px no maior lado (< 1 MB por foto) antes de commitar. Siga o guia: `docs/06-guia-de-fotos.md`.

Gerar e ver o modelo colorido: `make real TENIS=tenis-02` (padrão `tenis-01`, 30 cm; use `CM=28.5` com a medida
real) ou `make reais` para todos, e abrir http://localhost:5173/visualizador. Com `make api` rodando, a página `/fotos`
regera o modelo direto pelo botão "Aplicar e gerar o 3D". Qualquer `.glb` também pode ser aberto
pelo botão "Abrir arquivo .glb…". Para aparecer no seletor do visualizador, adicione o tênis em
`apps/web/src/lib/amostras.ts`.

As métricas e os avisos de cada execução ficam em `out/<tenis>/metricas.json` (orientação corrigida, consistência
entre as vistas, problemas de foto).
