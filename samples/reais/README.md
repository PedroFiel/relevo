# Fotos reais

Uma pasta por calçado: `tenis-01/`, `tenis-02/`, ...

```
tenis-01/
├── lateral.jpg   # calcanhar à esquerda, bico à direita
├── topo.jpg      # vista de cima, calcanhar à esquerda
├── frente.jpg    # olhando o bico
└── info.md       # medidas reais (comprimento × altura × largura em cm), cor, fundo, celular usado
```

Reduza para ~1600 px no maior lado (< 1 MB por foto) antes de commitar. Siga o guia: `docs/06-guia-de-fotos.md`.

Gerar e ver o modelo colorido: `make real` (padrão 30 cm; use `make real CM=28.5` com a medida real) e abrir
http://localhost:5173/visualizador. Qualquer `.glb` também pode ser aberto pelo botão "Abrir arquivo .glb…".
