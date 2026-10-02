# Fase 2 — Visualizador 3D

**Objetivo:** um visualizador completo e bonito, onde **os conceitos de CG ficam visíveis e explicados na tela**.
Tudo em `apps/web`, sem depender da API (usa `.glb` locais).

**Depende de:** Fase 0. **Roda em paralelo com:** Fase 1.
**Entrega da fase:** página `/visualizador` com modos de render, controle de luz, shading flat × suave, shader
customizado, eixos, estatísticas do modelo e carregamento por arrastar-e-soltar.

---

### F2-T01 — Base visual e layout
- **Frente:** front
- **Como fazer:**
  1. Tokens de design em `src/index.css` (cores, espaçamentos, raio, fonte). Modo escuro como padrão.
  2. Componentes base em `src/components/ui/`: `Botao`, `GrupoBotoes` (segmentado), `Painel`, `Slider`, `Etiqueta`.
  3. Layout `AppLayout` com cabeçalho (logo RELEVO, links Início / Novo modelo / Meus modelos) e `<Outlet/>`.
  4. Rotas finais já declaradas (mesmo vazias): `/`, `/novo`, `/modelos`, `/modelos/:id`, `/visualizador`.
  5. Página do visualizador: canvas à esquerda (70 %), painel de controles à direita (30 %); em celular, painel abaixo.
- **Testes:** Vitest renderiza cada rota sem erro; `Slider` chama `onChange`.
- **Aceite:** navegação entre páginas funciona; layout ok em 375 px de largura.

### F2-T02 — Câmera e controles de órbita
- **Frente:** front
- **Como fazer:**
  1. `OrbitControls` com `enableDamping`, limites de distância (`minDistance` 10, `maxDistance` 150) e de ângulo
     polar (não passar por baixo do chão).
  2. Botões de **vistas pré-definidas**: Lateral, Topo, Frente, Perspectiva — animar a câmera interpolando posição
     (lerp) e alvo em ~400 ms com `useFrame`.
  3. Botão "Ajustar ao modelo": calcular `Box3` do modelo e posicionar a câmera para enquadrar
     (distância = raio da esfera envolvente / sin(fov/2)).
  4. Alternar câmera **perspectiva × ortográfica** (`OrthographicCamera` da drei com `makeDefault`).
- **Testes:** função pura `distanciaParaEnquadrar(raio, fovGraus)` em `src/lib/camera.ts` testada no Vitest.
- **Aceite:** as vistas Lateral/Topo/Frente mostram o modelo igual às fotos de entrada.
- **Conceito de CG:** câmera virtual, projeção perspectiva × ortográfica, *frustum*, interpolação.

### F2-T03 — Modos de renderização
- **Frente:** front
- **Como fazer:** ampliar `src/lib/modosRender.ts` e `ModelViewer`:
  | Modo | Implementação | Conceito |
  |---|---|---|
  | Sólido | `MeshStandardMaterial` | PBR (rugosidade/metalicidade) |
  | Cores (quando houver `COLOR_0`) | `MeshStandardMaterial({ vertexColors: true })` | cor por vértice interpolada (Gouraud) |
  | Wireframe | `MeshBasicMaterial({ wireframe: true })` | malha poligonal |
  | Sólido + arestas | sólido + `<Edges threshold={15}/>` da drei | arestas vivas |
  | Normais | `MeshNormalMaterial` | normais → RGB |
  | Flat × Suave | toggle `flatShading` | normal por face × por vértice |
  Texto do "conceito" abaixo dos botões (já existe) com 1–2 frases didáticas por modo.
- **Testes:** `MODOS` contém todos os ids; cada um tem rótulo e conceito não vazio.
- **Aceite:** alternar modos não recarrega o modelo (materiais trocados no `useMemo`).

### F2-T04 — Iluminação controlável
- **Frente:** front
- **Como fazer:**
  1. Painel "Luz": intensidade ambiente, intensidade e **direção** da luz direcional (azimute/elevação em sliders →
     converter coordenadas esféricas em cartesianas em `src/lib/geometria.ts`).
  2. Mostrar a luz com `DirectionalLightHelper` (toggle).
  3. Sombras: `castShadow` no modelo, `receiveShadow` num plano de chão, `shadow-mapSize` 2048.
  4. Ambiente opcional com `<Environment preset="studio"/>` **somente se** funcionar offline; senão, luz hemisférica.
- **Testes:** `esfericaParaCartesiana(azimute, elevacao, raio)` testada (casos 0°, 90°).
- **Aceite:** mover o slider de elevação muda sombra e sombreamento em tempo real.
- **Conceito de CG:** modelos de iluminação (ambiente + difusa + especular), *shadow mapping*.

### F2-T05 — Shader customizado (GLSL)
- **Frente:** front
- **Como fazer:**
  1. `src/shaders/altura.vert` / `altura.frag` (importar com `?raw`): *vertex shader* passa a posição em mundo
     (`modelMatrix * vec4(position,1.0)`) como `varying`; *fragment shader* pinta um **mapa de calor por altura**
     (y normalizado → gradiente azul→vermelho) com faixas de contorno a cada 1 cm (`fract(y)`).
  2. Segundo shader: **Fresnel/"raio-x"** — `1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)))` como alfa.
  3. `ShaderMaterial` com `uniforms` (`uAlturaMax`, `uCor`) ligados a controles do painel.
- **Testes:** os arquivos de shader são importados e não vazios; snapshot do objeto `uniforms`.
- **Aceite:** modos "Altura" e "Raio-X" aparecem no seletor e respondem aos controles.
- **Conceito de CG:** pipeline programável, *vertex* × *fragment shader*, `varying`, `uniform`, espaços de coordenadas.

### F2-T06 — Ajudantes visuais
- **Frente:** front
- **Como fazer:** toggles para `axesHelper` (x vermelho = comprimento, y verde = altura, z azul = largura — mesma
  convenção do pipeline), grade de 1 cm/10 cm, `Box3Helper` (caixa envolvente) com as **dimensões em cm** em rótulos
  (`<Html>` da drei).
- **Aceite:** as dimensões mostradas batem com `metricas.dimensoes_cm` do pipeline.
- **Conceito de CG:** sistema de coordenadas do mundo, caixa envolvente (AABB).

### F2-T07 — Estatísticas do modelo
- **Frente:** front
- **Como fazer:** `src/lib/estatisticas.ts`: dado um `Object3D`, percorrer as `Mesh` e somar vértices
  (`geometry.attributes.position.count`) e triângulos (`index.count / 3`); dimensões via `Box3`. Exibir no painel +
  FPS (`<Stats/>` da drei, toggle).
- **Testes:** com uma `BoxGeometry` conhecida: 24 vértices, 12 triângulos, dimensões corretas.

### F2-T08 — Abrir arquivo local (arrastar e soltar)
- **Frente:** front
- **Como fazer:** área de *drop* no visualizador; `URL.createObjectURL(file)` → `useGLTF(url)`; aceitar `.glb` e `.gltf`;
  liberar a URL anterior (`revokeObjectURL`). Útil para testar saídas da CLI da Fase 1 sem API.
- **Aceite:** arrastar `out/tenis-01.glb` mostra o modelo real.

### F2-T09 — Testes visuais com Playwright
- **Frente:** front
- **Como fazer:** `apps/web/e2e/visualizador.spec.ts`: abrir `/visualizador`, esperar o canvas, clicar em cada modo e
  salvar screenshot em `e2e/__screenshots__/`. Chromium com `--use-angle=swiftshader` para WebGL sem GPU no CI.
  Script `npm run e2e`.
- **Aceite:** roda local e no CI (job separado, pode ser `continue-on-error` no começo).

## Conceitos pedidos pela professora (recorte, zoom, transformações, rastreamento)

Tarefas adicionadas em 01/10/2026 — ADR 0006 e [08-ferramentas-similares.md](../08-ferramentas-similares.md).
Todas entram no MVP. **Status (01/10): T10 a T13 feitas** (verificadas no navegador; relatório `2026-10-01-tenis-03.md`).
Diferença do plano: o plano de corte é definido nas coordenadas do modelo e acompanha a matriz do modelo.

### F2-T10 — Pipeline de visualização 2D: janela → viewport, zoom, pan e recorte
- **Frente:** front
- **Como fazer:**
  1. `src/lib/visualizacao2d.ts` (funções puras, sem React):
     - `matrizJanelaViewport(janela, viewport) -> Mat3` (escala + translação; o eixo y da tela cresce para baixo);
     - `zoomEmTorno(janela, ponto, fator)` → `T(p)·S(1/k)·T(−p)` aplicado à janela (o ponto sob o cursor fica parado);
       `pan(janela, dx, dy)`; `enquadrar(imagem, viewport)` (mantém a proporção);
     - **Cohen–Sutherland** `recortarSegmento(p0, p1, janela)` (códigos de região de 4 bits);
     - **Sutherland–Hodgman** `recortarPoligono(pontos, janela)` (recorte sucessivo contra as 4 bordas).
  2. Componente `src/components/VisorFoto.tsx`: `<canvas>` que desenha a foto pela matriz janela→viewport; roda do mouse
     e pinça = zoom no cursor (limite 1×–16×), arrastar = pan, duplo clique = enquadrar; prop `poligonos` desenha
     contornos **já recortados** com Sutherland–Hodgman (o recorte é nosso, não o do canvas — é o que mostramos na banca).
  3. Toggle "mostrar janela de recorte" que desenha a janela e destaca os trechos descartados (modo didático).
- **Testes (Vitest):** segmento totalmente dentro / fora / cruzando 1 e 2 bordas; polígono (triângulo e quadrado)
  recortado tem os vértices esperados; polígono todo fora → vazio; zoom em torno do cursor mantém o ponto fixo;
  `matrizJanelaViewport` leva os cantos da janela aos cantos do viewport.
- **Aceite:** ampliar 8× uma foto de 1600 px continua fluido (≥ 30 FPS) e o contorno acompanha a foto sem sair do visor.
- **Conceito de CG:** pipeline de visualização 2D, transformação janela–viewport, zoom/pan, recorte de linhas e
  polígonos, rasterização no canvas.

### F2-T11 — Plano de corte no modelo 3D (clipping)
- **Frente:** front
- **Como fazer:**
  1. `src/lib/corte.ts`: `planoDeCorte(eixo: 'x'|'y'|'z', posicaoCm, inverter) -> { normal, constante }` e
     `ladoDoPlano(ponto, plano)` (sinal de `n·p + d`).
  2. Modo "Corte" no painel: eixo, slider de posição (limites = caixa do modelo) e "inverter lado".
     `gl.localClippingEnabled = true` e `material.clippingPlanes = [new THREE.Plane(normal, constante)]`
     (materiais em `useMemo`, como já fazemos).
  3. **Tampa do corte** com *stencil buffer* (técnica do exemplo `webgl_clipping_stencil` do three.js): faces de trás
     incrementam, faces da frente decrementam; um plano desenhado onde o stencil ≠ 0 "fecha" o corte — prova visual de
     que a malha é **fechada** (watertight).
  4. Explicação na tela: o corte é feito pela GPU depois do *vertex shader*, em coordenadas de recorte — o mesmo
     mecanismo dos planos *near*/*far* da câmera (mostrar o valor de `camera.near`/`far`).
- **Testes:** `planoDeCorte` para cada eixo e inversão; `ladoDoPlano` com pontos conhecidos.
- **Aceite:** cortar o tênis no eixo x mostra a seção transversal preenchida, sem buracos.
- **Conceito de CG:** recorte contra semiespaços, recorte no pipeline gráfico (*frustum*, coordenadas de recorte),
  *stencil buffer*.

### F2-T12 — Zoom no ponto e rastreamento do cursor (raycasting)
- **Frente:** front
- **Depende de:** T02
- **Como fazer:**
  1. `onPointerMove` do r3f (raycasting): mostrar no painel o ponto sob o cursor em **cm** (espaço do objeto) e a normal
     da face; marcador pequeno no ponto.
  2. Zoom no ponto: roda do mouse aproxima a câmera **em direção ao ponto atingido** (`dolly` ao longo do raio), em vez
     do centro; sem interseção, comportamento normal do `OrbitControls`.
  3. Seletor "tipo de zoom": aproximar (*dolly*) × lente (muda o FOV) × ortográfico (`camera.zoom`) — com a frase do
     conceito: *dolly* muda a perspectiva, FOV não.
  4. `src/lib/camera.ts`: `pontoDeZoom(origem, alvo, ponto, fator)` (puro, testável).
- **Testes:** `pontoDeZoom` mantém a câmera na reta câmera→ponto e respeita `minDistance`; fator 1 não move.
- **Aceite:** passar o mouse sobre o bico mostra x ≈ metade do comprimento (convenção: modelo centrado em x).
- **Conceito de CG:** raycasting (interseção raio–triângulo), espaço do mundo × do objeto, *dolly* × FOV.

### F2-T13 — Transformações interativas: mover, girar e aumentar (base)
- **Frente:** front
- **Como fazer:**
  1. Modo "Transformar" com `TransformControls` (drei): translação, rotação e escala (uniforme em %), campos numéricos
     sincronizados (posição em cm, rotação em graus) e botão "Restaurar".
  2. `src/lib/matrizes.ts`: `compor(T, R, S)` montando a matriz homogênea 4×4 à mão (sem `Matrix4.compose`), e
     `aplicar(M, ponto)`. O painel "Matriz" mostra a 4×4 ao vivo e um toggle troca a ordem (`T·R·S` × `S·R·T`) para
     mostrar que **a ordem importa**.
  3. Dimensões do painel (F2-T06) passam a refletir a escala ("aumentar 10 %" → 33 cm).
  4. O que **fica para a F4-T03**: pivô por clique, atalhos G/R/S, desfazer e "salvar como nova versão".
- **Testes:** `compor` igual ao `Matrix4.compose` do three.js para casos conhecidos; `T·R·S ≠ S·R·T` num exemplo;
  escala 1,1 em 30 cm → 33 cm.
- **Conceito de CG:** transformações geométricas, coordenadas homogêneas, composição e ordem de matrizes.

### F2-T14 — Selecionar uma área, separar e mover (janela de seleção)
- **Frente:** front · **Status (02/10):** feito — ADR 0008, guia em `docs/09-funcionalidades-cg.md` §3
- **Como fazer:** retângulo desenhado sobre o canvas → NDC → 4 planos com a câmera (no espaço do objeto) →
  classificar e recortar triângulos com Sutherland–Hodgman 3D (`lib/selecao.ts`) → duas malhas; a parte centrada em si
  mesma, com `TransformControls` próprio; "Juntar de volta".
- **Testes:** área conservada; parte = retângulo; cor interpolada; seleção vazia.
- **Conceito de CG:** janela de seleção, recorte de polígonos contra planos, frustum, grafo de cena (nó com matriz).

### F2-T15 — Rastreamento de raios (ray tracing) × rasterização
- **Frente:** front · **Status (02/10):** feito — ADR 0008, guia em `docs/09-funcionalidades-cg.md` §5
- **Como fazer:** capturar a cena (geometria no mundo, câmera, luz, plano de corte) e a imagem da GPU; BVH na mediana;
  slab test; Möller–Trumbore; raio de sombra; Lambert com a cor por vértice; chão y = 0; render progressivo lado a lado;
  modo passo a passo; clique num pixel explica o raio.
- **Testes:** BVH = força bruta; casos do Möller–Trumbore; filtro do plano de corte; chão na sombra.
- **Conceito de CG:** rastreamento de raios, estruturas de aceleração, interseção raio–primitiva, sombras.

## Encerramento da Fase 2

- [ ] Prints de todos os modos no relatório da fase (são material para os slides)
- [ ] Tabela "conceito de CG → onde aparece na tela" atualizada em `02-arquitetura.md`
- [ ] Revisão de fase `docs/revisoes/fase-2.md`
