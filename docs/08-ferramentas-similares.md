# 08 — Ferramentas parecidas: o que fazem e o que aplicamos

Levantamento feito em 01/10/2026, a partir da conversa com a professora: o projeto precisa mostrar **recorte (cortar /
clipping), ampliação (zoom), transformações (mover, aumentar, girar), rastreamento e segmentação**. Olhamos o que as
ferramentas do mercado oferecem nessas áreas para decidir **o que entra no RELEVO e em qual tarefa**.

> As funcionalidades abaixo são as gerais e conhecidas de cada categoria; nomes de botões e detalhes mudam entre
> versões. Antes de citar uma ferramenta específica nos slides, abrir e conferir.

## 1. Quem faz algo parecido

| Categoria | Exemplos | Como gera o 3D | O que tem em comum com a gente |
|---|---|---|---|
| Captura 3D por fotos/vídeo (fotogrametria) | Polycam, KIRI Engine, RealityScan, Meshroom (código aberto) | dezenas de fotos, pontos casados entre elas (*structure from motion*) e, em vários casos, IA | recorte do volume, escala, medida, exportação |
| Captura com tapete marcador | Qlone | o tapete impresso (padrão xadrez) é **rastreado** em cada foto para achar a posição da câmera | ideia de rastreamento; silhuetas |
| Visualizadores 3D para loja | model-viewer (Google), Shopify 3D, Sketchfab | — (só mostram) | órbita, zoom, enquadrar, rotação automática, anotações |
| Editores / modelagem | Blender, Meshmixer | — (edição manual) | mover/girar/escalar com matriz, **corte por plano**, medidas |
| Editores de foto / remoção de fundo | Photoroom, remove.bg, editores de celular | segmentação **por IA** | cortar, girar, ampliar a foto, recorte do objeto |

O RELEVO é diferente de todos: **3 fotos padronizadas + algoritmos clássicos, sem IA** (ADR 0001). Por isso copiamos
as *interações*, não os métodos de reconstrução.

## 2. Mapa: funcionalidade de mercado → conceito de CG → onde entra no RELEVO

| O que as ferramentas fazem | Termo da professora | Conceito de CG por trás | No RELEVO | Tarefa | MVP? |
|---|---|---|---|---|---|
| Cortar e girar a foto antes de processar (editores de foto) | **cortar** | janela de recorte, transformação afim 2D (translação + rotação) em coordenadas homogêneas 3×3 | botão "Ajustar" em cada foto do upload; o pipeline usa só a região escolhida | F1-T11 + F3-T13 | sim |
| Ampliar/arrastar a foto para ver detalhes | **ampliar / dar zoom / mexer** | transformação **janela → viewport**, zoom em torno de um ponto `T(p)·S(k)·T(−p)`, *pan* | visor de foto com roda do mouse/pinça e arrastar | F2-T10 | sim |
| Mostrar o contorno do objeto encontrado sobre a foto | **rastrear** + **segmentação** | **rastreamento de contorno** (seguimento de borda: vizinhança de Moore / Suzuki–Abe) + simplificação de Douglas–Peucker | contorno da máscara desenhado sobre cada foto no resultado | F1-T12 + F3-T14 | sim |
| Desenhar só a parte visível da linha/polígono quando a foto está ampliada | **clipping** | recorte de segmentos (**Cohen–Sutherland**) e de polígonos (**Sutherland–Hodgman**) contra a janela | o contorno é recortado na janela antes de ser rasterizado no canvas | F2-T10 | sim |
| Corte por plano para ver o interior / seção (Blender, Meshmixer) | **cortar / clipping** em 3D | recorte contra semiespaço `n·p + d ≥ 0`, recorte no pipeline gráfico (coordenadas de recorte, *frustum*), *stencil buffer* para a tampa | modo "Corte" no visualizador com eixo e posição | F2-T11 | sim |
| Zoom no ponto sob o mouse; mostrar onde o mouse toca no modelo | **ampliar** + **rastrear** | **raycasting** (raio da câmera × triângulos), *dolly* × zoom por FOV × zoom ortográfico | zoom no ponto + coordenadas em cm do ponto sob o cursor | F2-T12 | sim |
| Mover, girar e aumentar o modelo com setas (gizmo) | **mexer / aumentar** | transformações geométricas com matrizes homogêneas 4×4, ordem de composição `T·R·S` | modo "Transformar" com painel mostrando a matriz | F2-T13 (base) → F4-T03 (pivô, salvar versão) | sim (base) |
| Remover o fundo da foto | **segmentação** | limiar por distância de cor em Lab + morfologia (sem IA) | já feito; agora fica **visível** para o usuário | F1-T06 (feito) + F3-T14 | sim |
| Pincel para corrigir o recorte do objeto | segmentação | rasterização de pinceladas, composição alfa | pincel de correção | F5-T05 (reusa o visor da F2-T10) | não |
| Régua / medir no modelo | rastrear (raycasting) | interseção raio-triângulo | régua 3D | F5-T03 (reusa a F2-T12) | não |
| Caixa de recorte do volume reconstruído (apps de fotogrametria) | cortar | recorte por caixa (AABB) | não precisamos: o visual hull já nasce justo na caixa do tênis | — | — |
| Rastrear câmera com tapete marcador / rastrear objeto em vídeo | rastrear | calibração de câmera, *tracking* de pontos entre quadros | **fora de escopo** (CLAUDE.md §14: fotos em ângulos livres só como extensão) | — | — |

**Status (01/10/2026):** F1-T11, F1-T12 e F2-T10 a T13 feitas; F3-T13/T14 com o front pronto (página `/fotos`),
aguardando o upload/API da Fase 3. Testado de ponta a ponta no tenis-03 (`docs/testes/relatorios/2026-10-01-tenis-03.md`).

**Adição de 02/10 — selecionar área, recortar e mover:** pedido da professora. É a "janela de seleção" dos editores
2D (seleção retangular → recortar → mover; GIMP, Paint, Flash) e o Separar dos editores 3D (Blender `B` + `P` →
Seleção; Meshmixer Select → Separate). No RELEVO: aba **Selecionar e mover** (F2-T14). Guia de uso e algoritmo em
[09-funcionalidades-cg.md](09-funcionalidades-cg.md).

## 3. O que fica de fora e por quê

- **Remoção de fundo por IA** (Photoroom, remove.bg): proibida pela regra 1. Nossa segmentação é clássica.
- **Fotogrametria com dezenas de fotos / rastreamento de câmera**: outra técnica, fora de escopo (D2).
- **Realidade aumentada** (ver o tênis no chão pelo celular): interessante, mas é Fase 5+ e não pedido pela disciplina.

## 4. O que "rastrear" significa (resolvido em 02/10 — ADR 0008)

Nas ementas de CG em português, "rastreamento" é quase sempre **rastreamento de raios** (ray tracing). Implementado na
aba **Rastrear raios** (F2-T15). Os outros sentidos também estão cobertos:

| Termo | Onde já aparece |
|---|---|
| Rastreamento de contorno | F1-T12 (novo) |
| Rastreamento de raios (ray tracing) | **F2-T15**: imagem por raios × rasterização, BVH, raio de sombra |
| Raycasting (um raio pelo mouse) | F2-T12, F4-T03 (pivô), F5-T03 (régua) |
| Rasterização | todo o visualizador (WebGL), F2-T10 (contorno desenhado no canvas), F1-T07 (rasterizar a malha para o IoU), F5-T05 (pincel) |

Confirmar com a professora qual dos três ela espera ver em destaque na apresentação.
