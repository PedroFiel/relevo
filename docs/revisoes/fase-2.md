# Revisão da Fase 2 — Visualizador 3D e Estúdio de CG

**Período:** 01/10 – 02/11/2026 · **Participantes:** Pedro · **Branch:** `fase-4/produto-completo`

## Entregue

| ID | Tarefa | Status | Observação |
|---|---|---|---|
| F2-T01 | Base visual, layout responsivo e Home | feito | Tokens CSS, componentes base `ui/`, responsividade 375 px e auditoria Impeccable (0 violações) |
| F2-T02 | Câmera e vistas rápidas | feito | Botões `3/4`, `Lateral`, `Topo`, `Frente`, `Enquadrar` e `distanciaParaEnquadrar` |
| F2-T03 | Modos de renderização | feito | `Sólido`, `Wireframe`, `Sólido + arestas`, `Flat`, `Normais` |
| F2-T04 | Iluminação controlável | feito | Sliders de azimute e elevação (`esfericaParaCartesiana`) + sombra de contato no chão |
| F2-T05 | Shaders GLSL customizados | feito | `Altura (GLSL)` (`altura.vert`/`.frag`) com isolinhas a cada 1 cm e `Fresnel (GLSL)` (`fresnel.vert`/`.frag`) |
| F2-T06 | Ajudantes visuais | feito | Toggles para grade no chão (2 cm) e eixos `axesHelper` (XYZ) |
| F2-T07 | Estatísticas detalhadas do modelo | feito | Contagem ao vivo de vértices, triângulos e dimensões em cm (`calcularEstatisticas`) |
| F2-T08 | Abrir arquivo `.glb` local | feito | Carregamento de arquivo `.glb`/`.gltf` com revogação de `ObjectURL` |
| F2-T09 | Testes visuais (Playwright) | feito | `apps/web/e2e/visualizador.spec.ts` com WebGL em software (SwiftShader) |
| F2-T10 | Visor 2D (janela → viewport e recorte) | feito | `VisorFoto.tsx` com Cohen–Sutherland e Sutherland–Hodgman 2D |
| F2-T11 | Plano de corte 3D + tampa por stencil + near | feito | Corte arbitrário em X/Y/Z com tampa via *stencil buffer* e recorte pelo plano *near* |
| F2-T12 | Zoom no ponto e cursor 3D | feito | Homotetia no ponto atingido por *raycasting* (`pontoDeZoom`) |
| F2-T13 | Transformações 4×4 (`T·R·S` × `S·R·T`) | feito | Matriz 4×4 ao vivo escrita à mão (`lib/matrizes.ts`) |
| F2-T14 | Selecionar área, separar e mover | feito | Frustum de 4 planos + Sutherland–Hodgman 3D (`lib/selecao.ts`) |
| F2-T15 | Rastreamento de raios × rasterização | feito | BVH + Möller–Trumbore + raio de sombra em CPU vs WebGL lado a lado (`lib/rastreamento.ts`) |

## Métricas

| Métrica | Meta | Resultado |
|---|---|---|
| Testes unitários e de componentes (Vitest) | 100 % passando | 22 arquivos (119 testes) passando |
| Auditoria de UI (`impeccable detect`) | 0 violações | `[]` (0 violações em `apps/web/src`) |
| Lint (`oxlint`) e build TypeScript (`tsc -b && vite build`) | 0 erros | 0 avisos e 0 erros |

## Pronto para a próxima fase?
**Sim.** Fase 2 100 % concluída.
