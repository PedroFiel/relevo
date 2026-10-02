# 09 — Funcionalidades de Computação Gráfica: o que é, como usar, como funciona

Guia de cada ferramenta do estúdio (`/visualizador` e `/fotos`), escrito para quem vai **usar** e para quem vai
**explicar na banca**. Para cada uma: o conceito de CG, o passo a passo na tela, o algoritmo, onde está o código e
como é testada. Fontes no fim.

## Onde cada coisa fica

```
make web   ->  http://localhost:5173
               ├── Modelo 3D  (/visualizador)  ferramentas ao lado do modelo, em abas:
               │     Ampliar · Recortar · Selecionar e mover · Transformar · Rastrear raios
               └── Fotos 2D   (/fotos)         as fotos que ENTRAM no pipeline: contorno, zoom,
                                               recorte da foto e "Aplicar e gerar o 3D" (precisa de `make api`)
```

**Por que duas metades?** Na disciplina, recorte, zoom e janela aparecem em **visualização 2D** (janela → visor,
Cohen–Sutherland, Sutherland–Hodgman) e em **visualização 3D** (câmera, volume de visão, planos de recorte).
O RELEVO tem os dois: as **fotos** (2D, a entrada) e o **modelo** (3D, a saída). Cada aba tem um quadro
"Como funciona (CG)" com a explicação curta.

---

## 1. Ampliar (zoom) — modelo 3D

| | |
|---|---|
| **Conceito** | câmera virtual; *dolly* (mover a câmera) × lente (campo de visão, FOV); raycasting |
| **Na tela** | aba **Ampliar**: ＋/－, **Enquadrar**, "Aproximar a câmera" ou "Lente (FOV)", roda do mouse amplia no ponto sob o cursor. O rodapé do visor mostra distância da câmera, FOV e *near* |
| **Como funciona** | *Aproximar*: a câmera anda; a perspectiva muda. *Lente*: a câmera fica parada e o FOV diminui (como recortar e ampliar a foto). *No ponto*: um raio sai da câmera pelo pixel do mouse, acha o ponto do modelo e câmera e alvo sofrem a homotetia `c' = p + (c − p)·k` — o ponto fica parado na tela. *Enquadrar*: distância = raio da esfera envolvente / sen(FOV/2) |
| **Código** | `apps/web/src/lib/camera.ts` (`pontoDeZoom`, `zoomLente`), `components/ModelViewer.tsx` (`ControleCamera`) |
| **Testes** | `lib/geometria3d.test.ts`: o ponto continua na reta câmera→ponto; distância mínima; limites do FOV |

## 2. Recortar (clipping) — modelo 3D

| | |
|---|---|
| **Conceito** | recorte = descartar o que está fora de uma região. No 3D: **volume de visão** (frustum) e **planos de recorte** |
| **Na tela** | aba **Recortar**. (a) *Plano de corte*: eixo (comprimento/altura/largura), posição, inverter lado, tampa. O plano aparece em amarelo. (b) *Recorte pela câmera*: slider **Near** — tudo mais perto da câmera que isso some |
| **Como funciona** | Cada fragmento com `n·p + d < 0` é descartado pela GPU (é o mesmo teste que ela faz com os 6 planos do frustum, depois do *vertex shader*, em coordenadas de recorte). O plano é definido no modelo e levado ao mundo pela matriz do modelo (acompanha mover/girar/aumentar). A **tampa** laranja usa o *stencil buffer*: faces de trás somam 1, da frente subtraem 1; onde sobra ≠ 0 o raio entrou no sólido e não saiu — só funciona porque a malha é **fechada** |
| **Código** | `lib/corte.ts` (`planoDeCorte`, `ladoDoPlano`), `ModelViewer.tsx` (`materiaisStencil`, `Tampa`, `IndicadorPlano`, `definirNear`) |
| **Testes** | `lib/geometria3d.test.ts`: lados do plano, ponto sobre o plano, mesma convenção do `THREE.Plane` |

## 3. Selecionar e mover (janela de seleção → recortar → mover) — modelo 3D

| | |
|---|---|
| **Conceito** | a "janela de seleção" dos editores (2D: seleção retangular → recortar → mover; 3D: Blender `B` + `P` Separar, Meshmixer Select → Separate) + recorte de polígonos + transformação de um nó filho |
| **Na tela** | aba **Selecionar e mover** → **Selecionar área** → arraste um retângulo sobre o tênis (ex.: o bico). A parte é separada; use **Mover a parte** / **Girar a parte** e arraste as setas. **Juntar de volta** desfaz |
| **Como funciona** | 1) Os 4 lados do retângulo, com a câmera, viram **4 planos** (um pedaço do frustum), levados para o espaço do objeto pela inversa da matriz do modelo. 2) Cada triângulo é classificado (`n·p + d`): todo dentro → parte; todo fora de algum plano → resto. 3) Quem cruza a borda é **recortado com Sutherland–Hodgman em 3D** (o mesmo do 2D, trocando a borda da janela por um plano): cada plano divide o polígono em dentro/fora, o de fora vai para o resto, o de dentro segue para o próximo plano; a cor do vértice novo é interpolada. 4) A parte vira uma malha própria, centrada nela mesma, com a **sua matriz** — mover só ela é transformar um nó filho do grafo de cena |
| **Exemplo medido** | bico do tenis-02: 38.215 triângulos na parte, 180.143 no resto, 673 recortados na borda, 141 ms |
| **Código** | `lib/selecao.ts` (`planosDaSelecao`, `dividirPoligono`, `separar`), `ModelViewer.tsx` (`separarSelecao`, `juntar`), `pages/Visualizador.tsx` (retângulo na tela → NDC) |
| **Testes** | `lib/selecao.test.ts`: parte + resto = área original; a parte é exatamente o retângulo (25 de 100); cor interpolada na borda; seleção fora não pega nada |
| **Limite** | a peça separada fica **aberta** no corte (dá para ver o lado de dentro); fechar com tampa seria triangular o contorno do corte |

## 4. Transformar (mover, girar, aumentar) — modelo 3D

| | |
|---|---|
| **Conceito** | transformações geométricas com **matrizes homogêneas 4×4**; ordem da composição |
| **Na tela** | aba **Transformar**: Mover/Girar/Aumentar com o gizmo ou digitando; dimensões em cm acompanham a escala; painel com a matriz e o botão **T·R·S × S·R·T** |
| **Como funciona** | o ponto vira (x, y, z, 1); `M = T·R·S` (a da direita age primeiro). Em S·R·T a translação também é girada e escalada (ex.: mover 10 cm em x com giro de 90° e escala 1,1 vira (0, 0, −11)) |
| **Código** | `lib/matrizes.ts` (`compor` à mão, igual ao `Matrix4.compose`) |
| **Testes** | `lib/geometria3d.test.ts`: igual ao three.js; T·R·S ≠ S·R·T; 30 cm × 1,1 = 33 cm |

## 5. Rastrear raios (ray tracing) — modelo 3D

| | |
|---|---|
| **Conceito** | **rastreamento de raios** × **rasterização**; BVH; interseção raio–caixa e raio–triângulo; raio de sombra; Lambert |
| **Na tela** | aba **Rastrear raios** → **Gerar imagem por rastreamento de raios**. Abre **lado a lado**: à esquerda a imagem da GPU (rasterização), à direita a nossa (raios), da mesma câmera. **Passo a passo** mostra a varredura linha por linha. **Clique num ponto da imagem da direita** para ver o caminho daquele raio |
| **O que olhar** | a **sombra do tênis no chão** só existe à direita: ela sai do raio de sombra. A rasterização do visualizador não calcula sombra projetada |
| **Como funciona** | Para cada pixel: 1) raio da câmera pelo pixel (desprojeção com a inversa de projeção·vista); 2) a **BVH** (árvore de caixas, divisão na mediana) descarta as caixas que o raio não cruza (*slab test*); 3) **Möller–Trumbore** acha o triângulo mais próximo e as coordenadas baricêntricas (que também interpolam a cor das fotos); 4) do ponto sai um **raio de sombra** até a luz — se bater em algo, só fica a luz ambiente; 5) cor = cor × (0,25 + 0,75·cos θ). O chão (y = 0) recebe a sombra do tênis |
| **Exemplo medido** | tenis-02, 309 × 268 px: ~83 mil raios primários + raios de sombra, 217 mil triângulos, BVH de 65.535 nós em ~0,35 s, imagem em ~1,4 s |
| **Exemplo do clique** | "Pixel (109, 115): … primeiro acerto é o triângulo nº 93.606 do tênis, a 47,4 cm, normal (−0,01; 0,13; 0,99). Raio de sombra: livre. Cor = cor da foto × (0,25 + 0,75 × cos θ = 0,59)" |
| **Código** | `lib/rastreamento.ts` (`construirBVH`, `intersectar`, `raioTriangulo`, `explicarRaio`, `raioDoPixel`), `components/RenderRaios.tsx` |
| **Testes** | `lib/rastreamento.test.ts`: BVH = força bruta em 200 raios aleatórios; Möller–Trumbore (acerto, paralelo, atrás); plano de corte deixa o raio atravessar; chão na sombra é mais escuro |
| **Raio do mouse** | o mesmo algoritmo para um pixel só: a leitura "cursor: x … y … z … cm" no rodapé é o raycasting |

## 6. Fotos 2D: visor (janela → viewport, zoom, pan, recorte)

| | |
|---|---|
| **Conceito** | pipeline de visualização 2D: **janela** (parte da foto visível) → **viewport** (o canvas); zoom = encolher a janela; pan = deslocá-la; **recorte** de linhas (Cohen–Sutherland) e polígonos (Sutherland–Hodgman) |
| **Na tela** | `/fotos`: roda do mouse/＋/－ amplia no cursor, arrastar move, duplo clique enquadra. "Mostrar janela de recorte" encolhe a janela (amarelo) e mostra tracejado em azul o que o recorte descartou |
| **Código** | `lib/visualizacao2d.ts`, `components/VisorFoto.tsx` |
| **Testes** | `lib/visualizacao2d.test.ts` (18 casos: códigos de região, segmento dentro/fora/cruzando, polígono recortado, zoom mantém o cursor fixo, cantos janela→viewport) |

## 7. Fotos 2D: contorno rastreado e segmentação

| | |
|---|---|
| **Conceito** | segmentação (distância de cor em Lab, morfologia, remoção do halo de sombra); **rastreamento de contorno** (seguimento de borda) e Douglas–Peucker |
| **Na tela** | o contorno laranja em cada foto; "Máscara" pinta a região; avisos em linguagem simples no topo |
| **Código** | `packages/pipeline/.../segmentacao.py`, `contorno.py` (Suzuki–Abe via OpenCV + versão didática de Moore) |
| **Testes** | `tests/test_contorno.py` (Moore = OpenCV), `tests/test_qualidade.py` (avisos, halo de sombra, peça clara preservada) |

## 8. Fotos 2D: recortar/girar a foto e gerar o 3D de novo

| | |
|---|---|
| **Conceito** | janela de recorte e transformação afim 2D (matriz 3×3) da foto antes do pipeline |
| **Na tela** | `/fotos` → **Ajustar** na foto → girar ↺/↻ e/ou arrastar um retângulo em volta de UM tênis → **Aplicar e gerar o 3D** (com `make api` rodando) → **Ver no 3D**. Sem a API: **Baixar ajustes.json**, salvar em `samples/reais/<tenis>/` e `make real TENIS=<tenis>` |
| **Como funciona** | o pipeline gira, recorta e guarda `M = R⁻¹·T(x, y)` (foto ajustada → original); o contorno volta à foto original com essa matriz |
| **Código** | `packages/pipeline/.../ajuste.py`; API `apps/api/.../routers/amostras.py` + `servicos/amostras.py` (`POST /amostras/{tenis}/gerar`); front `pages/Fotos.tsx` |
| **Testes** | `tests/test_ajuste.py` (matriz nas 4 rotações, recorte limitado), `apps/api/tests/test_amostras.py` (grava, publica, 422 com mensagem, nome inválido = 404) |

---

## Fontes

- Janela, visor, zoom, pan e recorte 2D/3D: [UBI — Janelas, Visores & Recorte](https://www.di.ubi.pt/~agomes/cg/teoricas/04-janelas.pdf),
  [LAPIX/UFSC — Clipping](https://lapix.ufsc.br/ensino/computacao-grafica/clipping-recorte/?lang=en),
  [PUCRS — Recorte](https://www.inf.pucrs.br/pinho/CG/Aulas/Vis2d/Recorte/Recorte.htm),
  [UEMS — Recorte e janela de seleção](https://www.comp.uems.br/~mercedes/disciplinas/2024/CG/CG-Recorte.pdf)
- Frustum, near/far, espaço de recorte: [LearnOpenGL — Coordinate Systems](https://learnopengl.com/Getting-started/Coordinate-Systems),
  [Scratchapixel — projeção e clipping](https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix//projection-matrix-GPU-rendering-pipeline-clipping.html)
- Tampa do corte com stencil: [three.js forum — clipping stencil capping](https://discourse.threejs.org/t/clipping-plane-stencil-capping/74018)
- Rastreamento de raios: [IME-USP — Rastreamento de Raios](https://www.ime.usp.br/~hitoshi/mac0420/notas/html/23-raytracing.html),
  [PUC-Rio/Tecgraf — Rastreamento de Raios](http://webserver2.tecgraf.puc-rio.br/~mgattass/LivroCG/05_Rastreamento_de_Raios.pdf)
- Selecionar e separar: [Blender — Separate](https://docs.blender.org/manual/en/dev/modeling/meshes/editing/mesh/separate.html),
  [Meshmixer — Select](https://meshmixers.com/meshmixer-select/)
