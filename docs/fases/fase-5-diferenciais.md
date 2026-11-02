# Fase 5 — Diferenciais e apresentação

**Objetivo:** os recursos que fazem a banca enxergar a computação gráfica acontecendo, e a preparação da apresentação.
Priorize na ordem abaixo — se o prazo apertar, T01 e T07 são as essenciais.

**Depende de:** Fase 4 (T02/T03 podem começar após a Fase 3).

---

### F5-T01 — Raio-X do pipeline (prioridade máxima) — **FEITO (28/10 + 02/11 com 7 etapas)**
- **Frente:** front, back
- **Como fazer:**
  1. Back: `GET /versoes/{id}/etapas` devolve as URLs dos intermediários salvos pela F1-T08 (fotos, máscaras, voxels,
     malha bruta, suave, decimada, final).
  2. Front: página `/modelos/:id/raio-x` com um **slider de 7 posições**; cada posição mostra a etapa + legenda curta do
     algoritmo:
     1. Fotos originais (3 imagens) · 2. Máscaras (Otsu + morfologia) · 3. Voxels (`InstancedMesh` com os cubos de
     superfície — um *draw call* para milhares de cubos) · 4. Malha bruta (Marching Cubes, wireframe) · 5. Suavizada (Taubin)
     · 6. Decimada (contagem de faces antes/depois) · 7. Final colorida/texturizada.
  3. Transição: *crossfade* de opacidade entre etapas; câmera mantida.
  4. Modo "apresentação": avança sozinho a cada 4 s.
- **Aceite:** do slider 1 ao 7 em menos de 1 minuto, explicando cada passo — é o roteiro da demo.
- **Como ficou (28/10):** aba **Raio-X do pipeline** em `/modelos/:id` (não uma rota separada), com **6** etapas:
  Fotos · Silhuetas · Voxels (`InstancedMesh`) · Malha bruta (arame) · Decimada (arame) · Final (cor). A "Suavizada"
  entra quando a F1-T02 existir. Sem rota `GET /versoes/{id}/etapas`: os intermediários já vêm em `versao.arquivos`
  do `GET /modelos/{id}` (tipos `mascara` e `etapa`). Crossfade: camadas 2D por CSS, objetos 3D pela opacidade no
  `useFrame`, câmera única. Modelos antigos (sem intermediários) mostram só Fotos e Final. Detalhes em
  `docs/09-funcionalidades-cg.md` (§9).
- **Conceito de CG:** todos; destaque para *instancing*.

### F5-T02 — LOD (níveis de detalhe) — **FEITO (02/11)**
- **Frente:** pipeline, front
- **Como ficou:** `malha.gerar_lods` gera 3 níveis (`100 %`, `25 %`, `5 %` das faces) preservando a cor por vértice; no visualizador, `nivelLodPorDistancia` e o toggle "LOD automático por distância" exibem o nível ativo (`LOD 0`, `LOD 1`, `LOD 2`) conforme a distância da câmera.
- **Conceito de CG:** LOD por distância à câmera, compromisso desempenho × qualidade.

### F5-T03 — Régua 3D — **FEITO (02/11)**
- **Frente:** front
- **Depende de:** F2-T12 (raycasting do cursor já existe)
- **Como ficou:** aba "Régua 3D" (`medir`) em `Visualizador.tsx` + marcadores esféricos e segmento 3D em `ModelViewer.tsx`, calculando `distanciaCm(p1, p2, escala)` em `cm` e `mm`.
- **Conceito de CG:** raycasting (interseção raio-triângulo), espaço do mundo × espaço do objeto.

### F5-T04 — Presets de destino na interface — **CANCELADA (28/10, ADR 0009)**
- **Por quê:** configuração única; nenhuma escolha técnica na interface (regra 11). Registro do que estava planejado:
- **Frente:** front, back
- **Como fazer:** cartões "Loja online (leve, colorido)", "Jogo (low poly)", "Impressão 3D (fechado, sem cor, .stl)" no
  upload e em "Regerar"; `POST /modelos/{id}/regerar {preset}` cria novo job reaproveitando as fotos (custa 1 crédito).

### F5-T05 — Pincel de correção da máscara — **FEITO (02/11)**
- **Frente:** front, back, pipeline
- **Depende de:** F2-T10 (`VisorFoto` com zoom/pan) e F3-T14 (máscara sobre a foto)
- **Como fazer:** editor em `<canvas>` (`EditorMascara.tsx`) sobre a foto com a máscara semitransparente inicializada pelo contorno automático; ferramentas pincel (adiciona) e
  borracha (remove), tamanho ajustável; envia as máscaras corrigidas como PNG base64 em `POST /modelos/{id}/regerar`; o pipeline aceita
  `mascaras_prontas` e substitui a segmentação automática nas vistas corrigidas.
- **Conceito de CG:** rasterização de pinceladas, composição alfa.

### F5-T06 — Visualizador incorporável — **FEITO (02/11)**
- **Frente:** front, back
- **Como ficou:** rotas públicas `GET /publico/{modelo_id}` e `GET /publico/{modelo_id}/glb`, página `/embed/:id` (`EmbedModelo.tsx`) sem cabeçalho/rodapé e painel "Incorporar (`<iframe>`)" em `ModeloDetalhe.tsx` com botão de copiar o código HTML.

### F5-T07 — Apresentação (essencial)
- **Frente:** todas
- **Como fazer:**
  1. Slides: problema → solução → **pipeline com as imagens reais de cada etapa** → arquitetura (3 camadas) → demo ao vivo
     (Raio-X) → limites (transparência) → próximos passos.
  2. Cada integrante apresenta a parte que construiu.
  3. Vídeo de backup da demo (caso a internet/GPU falhe).
  4. Ensaio cronometrado; perguntas prováveis da banca com respostas (ex.: "por que não pega a abertura do tênis?",
     "por que Taubin e não Laplaciano?", "como a matriz do pivô é composta?").
- **Aceite:** ensaio completo dentro do tempo, com demo funcionando a partir de fotos tiradas na hora.
- **Andamento (28/10):** roteiro pronto em `docs/apresentacao/roteiro.md` — 9 slides com tempo, as 6 imagens reais do
  Raio-X (`docs/apresentacao/imagens/`), passo a passo da demo ao vivo com plano B e 13 perguntas prováveis com
  resposta. **Falta (grupo):** montar os slides, dividir quem apresenta o quê, ensaiar e gravar o vídeo de backup.

## Encerramento do projeto

- [ ] Revisão final `docs/revisoes/fase-5.md` com lições aprendidas
- [ ] README com prints e link do vídeo
- [ ] Tag `v1.0.0`
