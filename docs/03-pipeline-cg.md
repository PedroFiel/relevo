# 03 — O pipeline de Computação Gráfica

Este é o coração do RELEVO e a parte que a banca mais vai querer entender. Cada etapa: **o que faz, a teoria,
onde está no código e como testamos.**

```
 [1] Segmentação  ->  [2] Alinhamento  ->  [3] Visual Hull  ->  [4] Marching Cubes
                                                                       |
 [8] Exportação  <-  [7] Textura/Cor  <-  [6] Decimação  <-  [5] Suavização
```

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

## [1] Segmentação — separar o tênis do fundo

**Arquivo:** `segmentacao.py` · **Função:** `gerar_mascara(img) -> bool[H, W]`

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

**Limitações:** objeto da mesma cor do fundo (tênis branco em fundo branco) continua falhando — o guia de fotos pede
fundo contrastante; sombras largas/suaves entram na máscara; faltam o aviso de qualidade da máscara e o pincel de
correção (F1-T06 restante e Fase 5). A versão antiga (Otsu) foi trocada porque falhava no caso comum de tênis
escuro com sola branca (relatório `docs/testes/relatorios/2026-10-01-fotos-reais-f0.md`).

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

**Teoria:** o *visual hull* (Laurentini, 1994) é a maior forma consistente com as silhuetas. Propriedade garantida
(e testada em `test_visual_hull_contem_o_objeto_original`): **o visual hull sempre contém o objeto real**.
Concavidades que não aparecem em nenhuma silhueta (abertura do pé) não são recuperadas.

**Extensão possível (Fase 5, opcional):** câmeras perspectivas com matriz de projeção 3×4 `P = K[R|t]` — o mesmo
algoritmo, mas projetando cada voxel com a matriz em vez de descartar um eixo.

## [4] Marching Cubes — voxels viram triângulos

**Arquivo:** `malha.py` · **Função:** `voxels_para_malha(ocupado, comprimento_cm) -> trimesh.Trimesh`

1. A ocupação vira um **campo escalar** `f(x,y,z) ∈ [0,1]`; aplicamos **desfoque gaussiano 3D (σ = 1)** para
   suavizar os degraus.
2. **Marching Cubes** (Lorensen & Cline, 1987): para cada célula 2×2×2, os 8 cantos são classificados como dentro
   (`f > 0,5`) ou fora → índice de 8 bits (256 casos, 15 únicos por simetria). Uma tabela diz quais triângulos gerar.
   A posição do vértice em cada aresta é **interpolada linearmente** onde `f` cruza 0,5.
3. **Escala real:** `spacing = comprimento_cm / L` converte índice de voxel em centímetros.
4. **Normais:** o trimesh corrige a orientação das faces (`fix_normals`) para todas apontarem para fora e
   calcula as normais por vértice (média das normais das faces vizinhas) — usadas no *shading* suave.
5. A borda de 2 voxels vazios (`np.pad`) garante **malha fechada** (*watertight*), requisito para impressão 3D.

## [5] Suavização — tirar o aspecto de "escada" (Fase 1)

**Laplaciana:** move cada vértice em direção à média dos vizinhos: `v' = v + λ·(média(vizinhos) − v)`.
Problema: **encolhe** o modelo. **Taubin (λ|μ):** alterna um passo com `λ > 0` e outro com `μ < −λ`,
funcionando como filtro passa-baixa sem encolher. Usaremos `trimesh.smoothing.filter_taubin`.

## [6] Decimação — menos triângulos, mesma forma (Fase 1)

**Simplificação por métrica de erro quádrico** (Garland & Heckbert, 1997): cada vértice acumula uma matriz 4×4 `Q`
com a soma das distâncias² aos planos das faces vizinhas; colapsa-se repetidamente a aresta cujo vértice resultante
tem menor erro `vᵀQv`. Alvos: e-commerce ≈ 20 mil faces, jogo ≈ 5 mil, impressão 3D sem decimação.

## [7] Cor e textura (Fase 1: cor por vértice · Fase 4: textura UV)

**Cor por vértice (Fase 1 — `cor.py`):** cada vértice é projetado de volta nas fotos (o inverso do visual hull: com
vistas ortográficas, basta descartar o eixo que a câmera não vê). Cada vista tem uma direção `d` (lateral ±z, topo +y,
frente +x) e peso `w = max(0, n·d)^4` — a foto que "vê de frente" aquele ponto manda mais; a cor é a média ponderada
com amostragem **bilinear**.
- O lado não fotografado usa a foto lateral **espelhada** (mesma posição na projeção ortográfica); o calcanhar (sem foto
  traseira) usa a lateral; o solado (nenhuma foto) fica cinza neutro.
- **Borda da silhueta:** os pixels da borda misturam tênis e fundo (halo claro). Antes de amostrar, a foto é "estendida":
  fora da máscara, e numa faixa de 3 px dentro dela, cada pixel copia o interior mais próximo (transformada de distância).
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
