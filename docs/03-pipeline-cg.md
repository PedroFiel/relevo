# 03 — O pipeline de Computação Gráfica

Este é o coração do RELEVO e a parte que a banca mais vai querer entender. Cada etapa: **o que faz, a teoria,
onde está no código e como testamos.**

```
 [0] Ajuste -> [1] Segmentação -> [1b] Orientação -> [1c] Contorno
            -> [2] Alinhamento + registro -> [3] Visual Hull (SDF) -> [3b] Seção transversal -> [4] Marching Cubes
                                                                                                    |
 [8] Exportação  <-  [7] Textura/Cor  <-  [6] Decimação  <-  [5] Suavização  <----------------------+
```

Vistas aceitas (ADR 0007): `lateral` e `topo` (obrigatórias), `frente` (recomendada), `outro_lado`, `sola`, `tras`.

Status: etapas 1–4 e 8 implementadas na **Fase 0** (prova de conceito). Etapas 5–7 entram na **Fase 1** (cor por vértice)
e **Fase 4** (textura UV).

---

## Convenção de eixos e vistas

```
            y (altura)
            |
            |______ x (comprimento: calcanhar -> bico)
           /
          z (largura)
```

| Vista | Câmera olha ao longo de | Linhas da imagem | Colunas da imagem | Eixo que a vista NÃO vê |
|---|---|---|---|---|
| `lateral` | −z | y (topo da foto = topo do tênis) | x (calcanhar à esquerda, bico à direita) | z (largura) |
| `topo` | −y | z | x (calcanhar à esquerda, bico à direita) | y (altura) |
| `frente` | −x (olhando o bico) | y | z | x (comprimento) |

Unidade final: **centímetros**. O modelo sai centrado em x/z e apoiado no chão (y = 0).

---

## [0] Ajuste da foto — recorte e rotação (F1-T11)

**Arquivo:** `ajuste.py` · **Funções:** `aplicar_ajuste(img, AjusteFoto) -> (img, M)`, `limitar_recorte`, `aplicar_matriz`

O usuário pode girar (90° em 90°, sentido **horário**) e recortar cada foto antes do processamento — pelo editor da
página `/fotos` ou num `ajustes.json` na pasta das fotos. O pipeline aplica a rotação e depois o recorte (o retângulo
é dado na foto **já girada**, que é o que o usuário vê) e guarda a **matriz afim 3×3** `M = R⁻¹ · T(x, y)` que leva
um ponto da foto ajustada de volta à original. Coordenadas **contínuas** de pixel (o pixel *i* ocupa [i, i+1)): assim
a rotação de uma imagem w × h leva cantos em cantos, sem erro de meio pixel. O retângulo é recortado contra os limites
da imagem (interseção) e recusado abaixo de 64 px. Rotação manual tem prioridade sobre a orientação automática ([1b]),
que também passa a ter matriz (`Orientacao.matriz`): `M_total = M_ajuste · M_orientação`.

## [1] Segmentação — separar o tênis do fundo

**Arquivo:** `segmentacao.py` · **Funções:** `segmentar(img) -> (mascara, bruta)`, `gerar_mascara(img) -> bool[H, W]`,
`qualidade_mascara(mascara, bruta, vista) -> list[str]`

1. **Filtro de mediana 5×5** — reduz ruído do sensor sem "alargar" as bordas (o gaussiano alargava o objeto).
2. **Cor do fundo** — mediana dos pixels da **borda** da foto, em **CIE Lab** (a borda é quase toda fundo; a mediana
   ignora molduras e cantos sujos).
3. **Distância de cor ao fundo** — `d = ‖Lab(pixel) − Lab(fundo)‖`; é objeto se `d > limiar`. O limiar é
   adaptativo: 4× o ruído típico da borda, entre 10 e 30. Funciona com fundo claro ou escuro e enxerga o
   **solado branco** em fundo cinza claro (o Otsu, que olha só o brilho, o jogava no fundo).
4. **Morfologia matemática** — *fechamento* (dilatação → erosão) fecha frestas; *abertura* (erosão → dilatação)
   com elemento ~1,5% do lado da imagem remove ruído e a **sombra de contato** (faixa fina escura sob o solado).
5. **Maior componente conexa** — descarta sujeiras soltas.
6. **Preenchimento de buracos** — *flood fill* a partir do canto; o que não foi alcançado é buraco interno
   (ex.: logo branco no tênis) e passa a ser objeto.
7. **Halo de sombra suave** (`_halo_de_sombra`, 02/10): em fundo de catálogo perfeito (ruído ~0) o limiar cai para o
   mínimo e o degradê da sombra em volta do tênis (~20 px) entrava na máscara — a silhueta "inchava" e a borda do modelo
   ganhava cor de sombra (o bico branco do tenis-03). Removemos a casca de pixels que são: mais escuros que o fundo e
   sem mudar de cor (a, b do Lab), mais perto do fundo que do vizinho escuro (critério da meia altura), num degradê
   (gradiente > 2/px) colado no fundo de verdade (≤ 2,5 % da foto) — mais a "cauda" quase da cor do fundo. **Trava
   global**: só aceita se a casca for fina (área ÷ perímetro ≤ largura máxima) e não partir o tênis; senão fica a máscara
   original (é o que protege o solado branco sombreado do tenis-01). Testes: halo não incha a silhueta; peça cinza-clara
   lisa colada no preto continua.
8. **Avisos de qualidade** (`qualidade_mascara`, em linguagem simples, vão para `metricas["avisos"]`):
   tênis encostando na borda (foto cortada), área < 5 % ou > 80 % da foto, e uma segunda componente grande
   (> 15 % da maior) na máscara bruta — sombra forte ou objeto no fundo.

**Limitações:** objeto da mesma cor do fundo (tênis branco em fundo branco) continua falhando — o guia de fotos pede
fundo contrastante; sombras largas/suaves entram na máscara; falta o pincel de correção (Fase 5). A versão antiga (Otsu) foi trocada porque falhava no caso comum de tênis
escuro com sola branca (relatório `docs/testes/relatorios/2026-10-01-fotos-reais-f0.md`).

## [1b] Orientação — calcanhar à esquerda, bico à direita

**Arquivo:** `orientacao.py` · **Funções:** `orientar_topo(m)`, `orientar_lateral(m) -> Orientacao`

O visual hull depende da convenção de eixos. Uma foto de topo tirada "em pé" (calcanhar em cima) troca comprimento por
largura: no tenis-02 isso gerou um modelo de **30 × 16 × 79 cm**, sem nenhum erro. Em vez de recusar a foto,
corrigimos usando a **anatomia do calçado** — só geometria da silhueta:

| Vista | Pista | Medido (tênis reais) | Correção |
|---|---|---|---|
| topo | o comprimento é o maior lado da caixa | — | silhueta em pé → gira 90° |
| topo | a parte mais larga (antepé) fica do lado do bico | ~0,67 do comprimento | antepé < 0,45 → gira 180° |
| lateral | a metade do calcanhar (cano) tem mais área que a do bico | razão 1,5–2,4 | razão < 1/1,15 → espelha |

- O topo só é **girado**, nunca espelhado: girar uma foto feita de cima equivale a girar a câmera (continua fisicamente
  correta). Espelhar a lateral equivale a fotografar o outro lado, que o pipeline já assume igual.
- A "posição do antepé" é o centro da faixa com largura ≥ 97 % da máxima (e não o `argmax`), para dar 0,5 numa forma
  simétrica. Entre 0,45 e 0,55 (ou razão lateral entre 0,87 e 1,15) o sinal é fraco: não mexemos e **avisamos**.
- A mesma correção é aplicada à foto colorida (usada na cor). Tudo vai para `metricas["orientacao"]` e um aviso
  explica ao usuário o que foi girado/espelhado. A frontal não é corrigida (não há pista confiável).

## [1c] Rastreamento de contorno (F1-T12)

**Arquivo:** `contorno.py` · **Funções:** `rastrear_contorno`, `rastrear_moore` (didática), `simplificar`, `medidas`

A borda da máscara vira um **polígono**: seguimento de borda de Suzuki–Abe (`cv2.findContours`) em produção e uma
versão didática com **vizinhança de Moore** + critério de parada de Jacob (testada: acha exatamente os mesmos pixels de
borda que o OpenCV, inclusive num "braço" de 3 px). Depois, **Douglas–Peucker** (tolerância 0,2 % do perímetro):
um círculo de 150 px de raio cai para < 10 % dos pontos. Perímetro e área (fórmula do laço de Gauss) vão para as
métricas. O contorno volta à foto ORIGINAL com `M_total` de [0] e o front o desenha sobre a foto enviada, recortado na
janela visível com Sutherland–Hodgman (F2-T10).

## [2] Alinhamento — colocar as 3 silhuetas na mesma grade

**Arquivo:** `alinhamento.py` · **Função:** `alinhar_vistas(lat, topo, frente, resolucao) -> VistasAlinhadas`

As fotos têm escalas e enquadramentos diferentes. Cada silhueta é **recortada na bounding box** e **reamostrada**
para que as medidas em comum batam:

| Medida | Vistas que compartilham |
|---|---|
| comprimento (x) | lateral e topo |
| altura (y) | lateral e frente |
| largura (z) | topo e frente |

Fixamos `L = resolucao` voxels no comprimento e derivamos `H = L · (altura/comprimento da lateral)` e
`W = L · (largura/comprimento do topo)`. A frente é reamostrada para `H × W`.

Isso é uma **transformação 2D de escala + translação** por vista (matriz afim). Na Fase 1 guardamos essa matriz
para conseguir o caminho inverso (ponto 3D → pixel na foto original), necessário para pintar a malha.

**Campo de distância assinada (SDF 2D)** — `distancia_assinada`, `campo_na_grade`: além da máscara 0/1 reduzida, cada
vista ganha `d(p)` = distância até a borda da silhueta, **negativa dentro e positiva fora**, calculada na foto em
resolução cheia (`cv2.distanceTransform` para fora e para dentro, subtraídos: os pixels vizinhos à borda ficam com +1
e −1 e o zero cai entre eles). O campo é recortado na caixa do objeto, reamostrado (bilinear) para a grade e convertido
de pixels para voxels. Ele guarda a posição da borda com **precisão de fração de voxel** — é o que tira os degraus.

## [3] Visual Hull — esculpir os voxels

**Arquivo:** `voxel.py` · **Função:** `esculpir(vistas) -> bool[L, H, W]`

Um **voxel** é o "pixel 3D". Começamos com um bloco cheio `L × H × W` e cada vista remove o que fica fora da sua silhueta.
Com **projeção ortográfica**, projetar um voxel `(x, y, z)` numa vista é só descartar o eixo que ela não vê:

```
ocupado[x, y, z] = lateral[y, x]  AND  topo[z, x]  AND  frente[y, z]
```

Em NumPy, por *broadcasting* (sem laços — 2 milhões de voxels em milissegundos):

```python
ocupado = lat.T[:, :, None] & top.T[:, None, :] & fre[None, :, :]
```

**Versão contínua (usada na malha)** — `campo_implicito(vistas) -> float[L, H, W]`. Com as SDFs das vistas, a
interseção dos três prismas é uma operação de **CSG com funções implícitas**: a interseção de sólidos é o **máximo**
das distâncias (a união seria o mínimo).

```
campo[x, y, z] = max(d_lateral(y, x), d_topo(z, x), d_frente(y, z))      campo < 0  <=>  dentro do hull
```

**Vistas opostas e registro (ADR 0007):** `outro_lado`, `sola` e `tras` enxergam os mesmos dois eixos que `lateral`,
`topo` e `frente`, só espelhados. Cada uma é levada ao **quadro canônico** da principal pelo espelhamento físico da
câmera (tabela em `vistas.py`) e soma mais um prisma à interseção. Como a foto da sola/traseira às vezes é do **outro
pé** do par (a imagem espelhada), cada extra é **registrada**: testamos o espelhamento físico e o oposto e ficamos com o
de maior IoU contra a principal (margem 0,01) — e avisamos. *Correção de 01/10:* a escultura usava a foto frontal
espelhada em relação à cor (não aparecia em tênis simétricos); agora a convenção física fica num lugar só.

`campo < 0` é (quase) o mesmo conjunto de voxels da escultura binária (teste: > 97 % iguais), mas o valor contínuo
diz *onde* a borda está entre dois voxels. `max` de SDFs não é uma SDF exata longe da superfície, mas o **nível zero**
é exatamente a interseção — e só ele importa para o Marching Cubes. A versão binária continua sendo calculada
(métricas, Raio-X e didática).

**Passa-baixa na borda:** a SDF 2D de cada foto recebe um desfoque gaussiano de ~1 voxel (medido na foto) antes de ir
para a grade. O ruído de 1–3 px da segmentação vira, na escala da grade, ondulações de fração de voxel que apareciam como
listras verticais no sombreamento (medido no tenis-01; Taubin não resolvia).

**Teoria:** o *visual hull* (Laurentini, 1994) é a maior forma consistente com as silhuetas. Propriedade garantida
(e testada em `test_visual_hull_contem_o_objeto_original`): **o visual hull sempre contém o objeto real**.
Concavidades que não aparecem em nenhuma silhueta (abertura do pé) não são recuperadas.

**Extensão possível (Fase 5, opcional):** câmeras perspectivas com matriz de projeção 3×4 `P = K[R|t]` — o mesmo
algoritmo, mas projetando cada voxel com a matriz em vez de descartar um eixo.

## [3b] Seção transversal comum — cilindro generalizado (ADR 0007)

**Arquivo:** `voxel.py` · **Função:** `campo_secao(campo_hull) -> (campo, perfil)`

Com fotos só nos 3 eixos, cada fatia x = constante do hull é a interseção de um retângulo (altura da lateral × largura do
topo) com a silhueta frontal — que, por ser a *união* de todas as fatias, quase não aperta: o bico sai "quadrado".
Hipótese: **todas as fatias têm o mesmo perfil T**, só escalado para a altura e a largura daquela fatia (uma varredura
de um perfil 2D ao longo de x — o *cilindro generalizado* da modelagem geométrica).

0. **Perfil suave (02/10):** o perfil T é descrito como duas funções da altura — borda esquerda e direita —, suavizadas
   (gaussiano σ = 2,5 linhas) e redesenhadas como polígono em alta resolução. Os degraus do perfil limiarizado viravam
   "curvas de nível" ao longo do tênis inteiro (aspecto derretido no tenis-03). IoU 3D no sintético: 0,982.
1. **Caixa contínua de cada fatia:** onde a sombra do campo na lateral/topo cruza zero, interpolada entre voxels, e
   suavizada ao longo de x (σ = 1,5 fatia). Caixas inteiras faziam a escala "pular" e a malha ficava ondulada.
2. **Perfil T:** cada fatia central (sem 10 % de cada ponta) é amostrada numa grade normalizada 64 × 64; se a hipótese
   vale, toda fatia normalizada CONTÉM T, então T = interseção — robusta: ponto dentro em ≥ 90 % das fatias. A fração
   é ampliada (bilinear) antes do limiar, para o perfil não sair serrilhado.
3. **Campo:** a SDF do perfil, amostrada nas coordenadas normalizadas de cada voxel e convertida para voxels;
   `campo_final = max(hull, seção)`. Só remove volume e as fatias continuam tocando altura e largura máximas.

**Validação:** no sintético a forma real é conhecida — IoU 3D com o objeto: **hull 0,923 → hull + seção 0,979**,
cortando < 2 % do volume real. A primeira tentativa (usar a silhueta frontal como perfil) **piorou** para 0,82: a
frontal é a união das fatias, não o perfil de uma (alta no calcanhar, larga no antepé). Sem foto frontal/traseira as
fatias do hull são retângulos, T sai retângulo e nada muda. Desligar: `--sem-secao`.

## [4] Marching Cubes — voxels viram triângulos

**Arquivo:** `malha.py` · **Funções:** `campo_para_malha(campo, comprimento_cm)` (usada no pipeline) e
`voxels_para_malha(ocupado, comprimento_cm)` (versão binária, didática)

1. **Campo escalar:** no pipeline, o campo de distância assinada do hull (nível 0). Na versão binária, a ocupação 0/1
   com **desfoque gaussiano 3D (σ = 1)** (nível 0,5) — mais simples de explicar, mas deixa degraus de um voxel.
2. **Marching Cubes** (Lorensen & Cline, 1987): para cada célula 2×2×2, os 8 cantos são classificados como dentro
   ou fora → índice de 8 bits (256 casos, 15 únicos por simetria). Uma tabela diz quais triângulos gerar.
   A posição do vértice em cada aresta é **interpolada linearmente** onde o campo cruza o nível. Com a SDF, essa
   interpolação cai na borda real da silhueta; com 0/1 desfocado, ela "anda" em degraus de um voxel.
   - **Cuidado:** um canto com valor *exatamente* igual ao nível gera triângulos degenerados e a malha deixa de ser
     fechada (acontece com SDF quando a borda cai no meio de dois pixels: +1 e −1 → 0). Esses pontos são empurrados
     para fora por 10⁻⁴.
3. **Escala real:** o comprimento **medido** da malha no eixo x vira exatamente o `comprimento_cm` informado
   (`tamanho_voxel = comprimento_cm / extensão_x`). Assumir `comprimento / L` errava ~0,2 % porque a borda cai numa
   fração de voxel.
4. **Normais:** o trimesh corrige a orientação das faces (`fix_normals`) para todas apontarem para fora e
   calcula as normais por vértice (média das normais das faces vizinhas) — usadas no *shading* suave.
5. A borda de 2 voxels vazios (`np.pad`) garante **malha fechada** (*watertight*), requisito para impressão 3D.

## [5] Suavização — tirar o aspecto de "escada" (Fase 1)

**Laplaciana:** move cada vértice em direção à média dos vizinhos: `v' = v + λ·(média(vizinhos) − v)`.
Problema: **encolhe** o modelo. **Taubin (λ|μ):** alterna um passo com `λ > 0` e outro com `μ < −λ`,
funcionando como filtro passa-baixa sem encolher. Usaremos `trimesh.smoothing.filter_taubin`.

**Medição (01/10, tenis-02):** a escada vinha do campo 0/1 e foi resolvida na origem pelo campo de distância (etapas
2–4): num cilindro de superfície conhecida, o erro médio das normais caiu de 3,3° para 1,6°. Taubin depois disso mudou
pouco (desvio do ângulo entre faces vizinhas 4,5° → 3,5°, volume igual): as "listras" que sobram são **detalhes reais
de uma silhueta estendidos** ao longo do eixo que ela não vê (limite do visual hull), não ruído. A F1-T02 continua no
plano, agora como refinamento.

## [6] Decimação — menos triângulos, mesma forma (Fase 1)

**Simplificação por métrica de erro quádrico** (Garland & Heckbert, 1997): cada vértice acumula uma matriz 4×4 `Q`
com a soma das distâncias² aos planos das faces vizinhas; colapsa-se repetidamente a aresta cujo vértice resultante
tem menor erro `vᵀQv`. Alvos: e-commerce ≈ 20 mil faces, jogo ≈ 5 mil, impressão 3D sem decimação.

## [7] Cor e textura (Fase 1: cor por vértice · Fase 4: textura UV)

**Cor por vértice (Fase 1 — `cor.py`):** cada vértice é projetado de volta nas fotos (o inverso do visual hull: com
vistas ortográficas, basta descartar o eixo que a câmera não vê). Cada vista tem uma direção `d` (lateral ±z, topo +y,
frente +x) e peso `w = max(0, n·d)^4` — a foto que "vê de frente" aquele ponto manda mais; a cor é a média ponderada
com amostragem **bilinear**.
- Cada vista pinta as faces voltadas para ela (`direcao` em `vistas.py`): lateral +z, outro lado −z, topo +y, sola −y,
  frente +x, traseira −x. Sem a foto do outro lado, a lateral **espelhada** pinta os dois lados (mesma posição na
  projeção ortográfica); sem foto da sola, o solado fica cinza neutro; onde nenhuma foto vê de frente (bico/calcanhar
  sem foto), um peso mínimo (10⁻³) faz a cor vir da lateral e não de uma média de tudo.
- **Onde nenhuma foto vê de frente** (bico sem foto frontal, 02/10): projetar uma foto numa face quase de lado ESTICA
  uma tira de pixels sobre uma área grande. A cor vira `α·projetada + (1 − α)·média dos vizinhos`, com α = confiança da
  melhor foto (cos⁴ normalizado por 0,2); iterar (Jacobi, 200×) resolve a **equação de Laplace discreta** no grafo da
  malha: a cor "escorre" das faces bem fotografadas (`preencher_sem_foto`).
- **Borda da silhueta:** os pixels da borda misturam tênis e fundo (halo claro). Antes de amostrar, a foto é "estendida":
  fora da máscara, e numa faixa dentro dela, cada pixel copia o interior mais próximo (transformada de distância). A faixa
  acompanha o tamanho do tênis na foto (1 % do maior lado, mínimo 3 px): 3 px fixos não bastavam nas fotos de 768 px.
- **Espaço de cor:** as fotos estão em sRGB; o glTF exige `COLOR_0` em **linear**. Convertemos (curva IEC 61966-2-1);
  sem isso o vermelho aparece rosa e o preto, cinza.
- **Detalhe visual** depende da resolução da malha: a 128 voxels (~0,23 cm/vértice) o cadarço e o logo ficam borrados;
  a 256 aparecem. Por isso o `make real` usa 256 (~1,5 s).

**Textura UV (Fase 4):** `xatlas` "desdobra" a malha num plano (atlas UV, minimizando distorção). Para cada *texel* do
atlas, calculamos o ponto 3D correspondente e amostramos as fotos com a mesma regra de pesos → imagem de textura
`baseColor` num material **PBR** do glTF.

## [8] Exportação

**Arquivo:** `exportar.py`. `.glb` (glTF binário: geometria + material + textura num arquivo, padrão da web),
`.obj` (universal, texto), `.stl` (só geometria, impressão 3D).

---

## Métricas de qualidade que o pipeline reporta

| Métrica | Como | Meta |
|---|---|---|
| Malha fechada | `malha.is_watertight` | sempre `true` |
| Erro dimensional | dimensões do modelo × medida real com fita métrica | < 5 % |
| IoU de reprojeção (Fase 1) | reprojetar a malha nas 3 vistas e comparar com as máscaras: `|A∩B| / |A∪B|` | > 0,90 |
| `consistencia.iou_<vista>` (já existe, F1-T07 parcial) | mesma ideia, mas projetando os **voxels** na grade alinhada (`metricas.py`) | > 0,90 |
| `consistencia.razao_frente` | proporção altura/largura da frontal ÷ a que lateral e topo implicam | 1 ± 0,15 (fora disso: aviso) |
| `orientacao` | o que foi girado/espelhado em cada foto e se a pista era confiável | — |
| `avisos` | mensagens para o usuário: correções feitas e problemas de foto | lista vazia |
| Faces | `len(malha.faces)` | conforme preset |
| Tempo total | soma dos `tempos_s` | < 10 s (resolução 128) |

## Referências

- Laurentini, A. *The Visual Hull Concept for Silhouette-Based Image Understanding*. IEEE PAMI, 1994.
- Lorensen, W.; Cline, H. *Marching Cubes: A High Resolution 3D Surface Construction Algorithm*. SIGGRAPH, 1987.
- Taubin, G. *A Signal Processing Approach to Fair Surface Design*. SIGGRAPH, 1995.
- Garland, M.; Heckbert, P. *Surface Simplification Using Quadric Error Metrics*. SIGGRAPH, 1997.
- Otsu, N. *A Threshold Selection Method from Gray-Level Histograms*. IEEE SMC, 1979.
- Documentação: [scikit-image marching_cubes](https://scikit-image.org/docs/stable/api/skimage.measure.html#skimage.measure.marching_cubes) ·
  [trimesh](https://trimesh.org/) · [xatlas-python](https://github.com/mworchel/xatlas-python) · [Three.js](https://threejs.org/docs/)
