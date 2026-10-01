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

## Encerramento da Fase 2

- [ ] Prints de todos os modos no relatório da fase (são material para os slides)
- [ ] Tabela "conceito de CG → onde aparece na tela" atualizada em `02-arquitetura.md`
- [ ] Revisão de fase `docs/revisoes/fase-2.md`
