# Fase 5 — Diferenciais e apresentação

**Objetivo:** os recursos que fazem a banca enxergar a computação gráfica acontecendo, e a preparação da apresentação.
Priorize na ordem abaixo — se o prazo apertar, T01 e T07 são as essenciais.

**Depende de:** Fase 4 (T02/T03 podem começar após a Fase 3).

---

### F5-T01 — Raio-X do pipeline (prioridade máxima)
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
- **Conceito de CG:** todos; destaque para *instancing*.

### F5-T02 — LOD (níveis de detalhe)
- **Frente:** pipeline, front
- **Como fazer:** pipeline gera 3 níveis (100 %, 25 %, 5 % das faces) salvos como arquivos com `nivel_lod`; front usa
  `<Detailed distances={[0, 40, 90]}>` da drei; indicador na tela de qual nível está ativo (cor diferente opcional).
- **Conceito de CG:** LOD por distância à câmera, compromisso desempenho × qualidade.

### F5-T03 — Régua 3D
- **Frente:** front
- **Depende de:** F2-T12 (raycasting do cursor já existe)
- **Como fazer:** modo "Medir": clique 1 e clique 2 na superfície (evento `onPointerDown` do r3f traz o `point` do
  **raycasting**); desenhar linha + esferas nos pontos + rótulo com a distância em cm (`point1.distanceTo(point2)`,
  considerando a matriz de escala da versão).
- **Testes:** função `distanciaCm(p1, p2, escala)` no Vitest.
- **Conceito de CG:** raycasting (interseção raio-triângulo), espaço do mundo × espaço do objeto.

### F5-T04 — Presets de destino na interface
- **Frente:** front, back
- **Como fazer:** cartões "Loja online (leve, colorido)", "Jogo (low poly)", "Impressão 3D (fechado, sem cor, .stl)" no
  upload e em "Regerar"; `POST /modelos/{id}/regerar {preset}` cria novo job reaproveitando as fotos (custa 1 crédito).

### F5-T05 — Pincel de correção da máscara
- **Frente:** front, back, pipeline
- **Depende de:** F2-T10 (`VisorFoto` com zoom/pan) e F3-T14 (máscara sobre a foto)
- **Como fazer:** editor em `<canvas>` sobre a foto com a máscara semitransparente; ferramentas pincel (adiciona) e
  borracha (remove), tamanho ajustável; envia as máscaras corrigidas como PNG em `regerar`; o pipeline aceita
  `mascaras` prontas e pula a segmentação.
- **Conceito de CG:** rasterização de pinceladas, composição alfa.

### F5-T06 — Visualizador incorporável
- **Frente:** front, back
- **Como fazer:** toggle "Público" no modelo; rota `/embed/:id` só com o canvas (sem cabeçalho); botão "Copiar código"
  gera `<iframe src=".../embed/<id>" width="600" height="400">`. Útil para colar na página de produto de uma loja.

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

## Encerramento do projeto

- [ ] Revisão final `docs/revisoes/fase-5.md` com lições aprendidas
- [ ] README com prints e link do vídeo
- [ ] Tag `v1.0.0`
