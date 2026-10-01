# Fase 1 — Pipeline completo

**Objetivo:** transformar a prova de conceito num pipeline robusto: malha lisa, leve, colorida, em escala real,
com métricas de qualidade e testes. Tudo em `packages/pipeline`.

**Depende de:** Fase 0 (F0-T10 mostra os problemas reais a resolver).
**Roda em paralelo com:** Fase 2.
**Entrega da fase:** `relevo-pipeline gerar ... --preset ecommerce` produz um `.glb` **colorido, suave, ~20 mil faces**
em < 10 s, e um `metricas.json` com IoU de reprojeção > 0,90 nos exemplos sintéticos.

---

### F1-T01 — Configuração e presets
- **Frente:** pipeline
- **Como fazer:**
  1. Criar `config.py` com `@dataclass(frozen=True) class ConfigPipeline`: `resolucao=128`, `sigma_campo=1.0`,
     `iteracoes_suavizacao=10`, `faces_alvo: int | None = 20000`, `cor=True`, `expoente_peso=4.0`.
  2. `PRESETS = {"ecommerce": ConfigPipeline(...), "jogo": ConfigPipeline(faces_alvo=5000, ...), "impressao3d": ConfigPipeline(faces_alvo=None, cor=False, resolucao=160)}`.
  3. `processar(..., config: ConfigPipeline = PRESETS["ecommerce"])`; CLI ganha `--preset` (sobrescrito por `--resolucao`).
  4. `ConfigPipeline.para_dict()` → vai para `jobs.parametros` na Fase 3.
- **Testes:** cada preset roda no sintético; `para_dict()` é serializável em JSON.
- **Aceite:** `--preset jogo` gera ≤ 5 000 faces.

### F1-T02 — Suavização de Taubin
- **Frente:** pipeline
- **Depende de:** T01
- **Como fazer:**
  1. Em `malha.py`, função `suavizar(malha, iteracoes) -> Trimesh` usando
     `trimesh.smoothing.filter_taubin(malha, lamb=0.5, nu=0.53, iterations=iteracoes)` (opera *in place*: copiar antes).
  2. Chamar logo após o Marching Cubes. Guardar `malha_bruta` e `malha_suave` no `ResultadoPipeline` (Raio-X).
  3. Comentário no código explicando Laplaciano × Taubin (ver `03-pipeline-cg.md` §5).
- **Testes:**
  - volume após suavizar varia **< 3 %** (Taubin não encolhe; comparar com Laplaciano, que encolhe mais — teste demonstrativo);
  - malha continua `is_watertight`;
  - "rugosidade" diminui: desvio-padrão do ângulo entre normais de faces vizinhas (`malha.face_adjacency_angles.std()`) cai.
- **Aceite:** no visualizador, os degraus visíveis na Fase 0 somem.
- **Conceito de CG:** filtragem de malhas, operador Laplaciano discreto, encolhimento × filtro λ|μ.

### F1-T03 — Decimação por erro quádrico
- **Frente:** pipeline
- **Depende de:** T02
- **Como fazer:**
  1. `decimar(malha, faces_alvo) -> Trimesh` com `malha.simplify_quadric_decimation(face_count=faces_alvo)`
     (backend `fast-simplification`). Se `faces_alvo is None` ou a malha já for menor, retorna cópia.
  2. Após decimar: `malha.remove_unreferenced_vertices()`, `malha.fix_normals()`.
  3. Medir o **erro geométrico**: amostrar 5 000 pontos da malha original (`trimesh.sample.sample_surface`) e calcular a
     distância à decimada com `trimesh.proximity.closest_point` → `erro_medio_mm` e `erro_max_mm` nas métricas.
- **Testes:** faces ≤ alvo (+2 % de tolerância); erro médio < 0,5 mm no sintético; dimensões ±1 %.
- **Aceite:** preset e-commerce gera ~20 mil faces com diferença visual imperceptível.
- **Conceito de CG:** simplificação de malhas, métrica de erro quádrico (Garland-Heckbert), colapso de arestas.

### F1-T04 — Transformação inversa: ponto 3D → pixel da foto
- **Frente:** pipeline
- **Depende de:** —
- **Como fazer:**
  1. Em `alinhamento.py`, `VistasAlinhadas` ganha, por vista, uma **matriz afim 3×3** `M` que leva
     (coluna, linha) da grade alinhada → (u, v) em pixels da foto original:
     `M = T(bbox_x0, bbox_y0) · S(largura_bbox / colunas_grade, altura_bbox / linhas_grade)`.
  2. Função `projetar(pontos_cm, vista) -> uv_pixels`: converte cm → índice de voxel (inverso do `spacing` e da
     translação de centralização — guardar esse deslocamento no resultado de `voxels_para_malha`), escolhe os 2 eixos da
     vista (lateral: x,y com y invertido; topo: x,z; frente: z,y com y invertido) e aplica `M` em coordenadas homogêneas.
- **Testes:** projetar os vértices da malha sintética na lateral: **> 98 %** caem dentro da máscara original;
  ida-e-volta (grade → foto → grade) com erro < 1 pixel.
- **Aceite:** função usada pela T05 e T07.
- **Conceito de CG:** transformações 2D em coordenadas homogêneas, composição de matrizes, projeção ortográfica.

### F1-T05 — Cor por vértice (projeção das fotos)
- **Frente:** pipeline
- **Depende de:** T04
- **Como fazer:**
  1. `cor.py`: `colorir(malha, fotos_bgr, vistas, expoente=4) -> Trimesh`.
  2. Direções de vista: lateral `±z`, topo `+y`, frente `+x` (bico) e `−x` (calcanhar usa a frontal espelhada).
  3. Para cada vértice com normal `n`: peso de cada vista `w = max(0, n·d)^p`; amostrar a cor com interpolação
     **bilinear** (`cv2.remap`) no pixel `projetar(v, vista)`; cor = Σ w·c / Σ w. Sem peso (solado, `n·(−y)`): cinza neutro `#808080`.
  4. Lado `−z` usa a mesma foto lateral (espelhamento natural da projeção ortográfica — documentar).
  5. `malha.visual.vertex_colors = cores_rgba`; o `.glb` exporta como atributo `COLOR_0`.
- **Testes:** no sintético (objeto vermelho escuro `(170, 50, 60)` RGB), cor média dos vértices visíveis a ±15;
  vértices do solado = cinza; nenhum vértice preto puro (indicaria amostra fora da foto).
- **Aceite:** no gltf-viewer o tênis real aparece com as cores dele.
- **Conceito de CG:** projeção de textura, produto escalar normal × direção de visão (o mesmo termo de Lambert), interpolação bilinear.

### F1-T06 — Segmentação robusta (chroma key + controles)
- **Frente:** pipeline
- **Como fazer:**
  1. `gerar_mascara(img, metodo="otsu" | "cor_fundo", tolerancia=…, kernel=…)`.
  2. Método `cor_fundo`: estima a cor do fundo pela **mediana dos pixels da borda** em HSV/Lab e marca como fundo
     tudo a distância < tolerância (resolve tênis branco em fundo verde/azul).
  3. Função `qualidade_mascara(m)` → avisos: objeto tocando a borda (foto cortada), área < 5 % ou > 80 % do quadro,
     mais de 1 componente grande (sombra?). Avisos vão para as métricas e depois para a tela.
- **Testes:** imagem sintética de objeto branco em fundo verde funciona com `cor_fundo`; avisos disparam nos casos certos.
- **Aceite:** os 2 tênis reais da F0-T10 segmentam bem com pelo menos um dos métodos.

### F1-T07 — Métricas de qualidade e consistência
- **Frente:** pipeline
- **Depende de:** T04
- **Como fazer:**
  1. **IoU de reprojeção:** rasterizar a silhueta da malha final em cada vista (projetar vértices com T04 e preencher
     triângulos com `cv2.fillPoly` numa imagem do tamanho da máscara) e calcular `|A∩B|/|A∪B|` com a máscara original.
  2. **Consistência entre vistas:** razão altura(lateral)/altura(frente) e largura(topo)/largura(frente) após
     normalização; se divergirem > 15 %, aviso "as fotos parecem ter escalas/ângulos diferentes".
  3. Tudo em `ResultadoPipeline.metricas`.
- **Testes:** IoU > 0,90 nas 3 vistas do sintético; aviso de consistência dispara quando a frente é esticada 30 %.
- **Conceito de CG:** rasterização de polígonos, avaliação quantitativa de reconstrução.

### F1-T08 — Intermediários para o Raio-X e progresso
- **Frente:** pipeline
- **Como fazer:**
  1. `processar(..., ao_progredir: Callable[[str, int], None] | None)` — chamado a cada etapa com
     `(nome_etapa, percentual)`. A API (Fase 3) usa isso para atualizar o job.
  2. `ResultadoPipeline.salvar_intermediarios(pasta)` grava: máscaras PNG, `voxels.glb` (cubos dos voxels de superfície
     — usar só os voxels com vizinho vazio, para não explodir o arquivo), `malha_bruta.glb`, `malha_suave.glb`, `final.glb`.
- **Testes:** callback recebe as etapas na ordem certa e termina em 100; arquivos criados.

### F1-T09 — Desempenho
- **Frente:** pipeline
- **Como fazer:** medir com `tempos_s`; meta < 10 s na resolução 128 no notebook mais fraco do grupo. Se a cor estiver
  lenta, vetorizar com NumPy (sem laço por vértice). Registrar a tabela resolução × tempo × faces no relatório da fase.
- **Testes:** teste marcado `@pytest.mark.lento` que falha se o preset e-commerce passar de 15 s.

### F1-T10 — Notebook didático
- **Frente:** pipeline
- **Como fazer:** `notebooks/01-pipeline-passo-a-passo.ipynb` com cada etapa visualizada (imagens com matplotlib,
  fatias do volume de voxels, malha com `trimesh.Scene.show()` ou screenshot). Será usado na apresentação.
- **Aceite:** "Run all" funciona do zero após `uv sync`.

## Encerramento da Fase 1

- [ ] Todas as tarefas com testes passando
- [ ] Relatório em `docs/testes/relatorios/` com os tênis reais: prints antes/depois, métricas (IoU, erro dimensional, faces, tempo)
- [ ] `docs/03-pipeline-cg.md` atualizado se alguma decisão mudou
- [ ] Revisão de fase `docs/revisoes/fase-1.md`
