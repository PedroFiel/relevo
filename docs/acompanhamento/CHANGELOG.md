# Changelog

Mudanças visíveis para quem usa ou avalia o projeto. Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado (28/10/2026 — cara de produto)
- **Nova home**: a frase da missão, "como funciona" em 3 passos, botão **Criar modelo** e um bloco de
  transparência (sem IA; o que o algoritmo não consegue). Funciona em 375 px. [F2-T01]
- **Cabeçalho** em todas as páginas (Início / Novo modelo / Meus modelos) e rodapé com o guia e o estúdio.
- **Guia de fotos** no site (`/guia`): regras de ouro, como posicionar cada vista e o que esperar.
- Páginas de **Novo modelo**, **Meus modelos** e do modelo já existem (ainda sem conteúdo) e há uma página 404.

### Adicionado (28/10/2026 — API do MVP)
- **API de modelos**: `POST /modelos` recebe as fotos (2 a 6), o tamanho em cm e os ajustes de recorte/rotação,
  valida cada foto pelo conteúdo e responde na hora; o modelo é gerado em segundo plano. `GET /jobs/{id}` mostra a
  etapa e o percentual; `GET /modelos`, `GET /modelos/{id}`, download do `.glb`, `GET /imagens/{id}` e
  `DELETE /modelos/{id}` (apaga também os arquivos). Tudo gravado no PostgreSQL. [F3-T02…T06]
- **Modelos mais leves**: decimação por erro quádrico até ~20 mil faces. O tenis-01 caiu de 6,6 MB para 0,52 MB
  (erro médio 0,07 mm), continua fechado e com as mesmas medidas. `--faces-alvo 0` na CLI desliga. [F1-T03]

### Adicionado (27/10/2026 — banco do MVP)
- **Banco**: tabelas `usuarios`, `modelos`, `imagens` (as 6 vistas), `jobs`, `versoes` e `arquivos`, com o usuário
  demo, por migração Alembic (`59787083ad48`, com `downgrade`). Testes num banco `relevo_test` isolado; o CI sobe um
  PostgreSQL 16. [F3-T01]

### Adicionado (02/10/2026 — revisão das funcionalidades)
- **Estúdio**: ferramentas ao lado do modelo em abas, cada uma com "Como funciona (CG)"; abas Modelo 3D | Fotos 2D.
- **Rastrear raios**: imagem por rastreamento de raios lado a lado com a da GPU (sombra no chão), modo passo a passo e
  explicação do raio de qualquer pixel clicado. [F2-T15]
- **Selecionar e mover**: arraste um retângulo sobre o tênis, a parte é recortada (Sutherland–Hodgman 3D) e pode ser
  movida/girada; "Juntar de volta". [F2-T14]
- **Recortar**: plano de corte desenhado no modelo e recorte pelo plano near da câmera.
- **Fotos**: "Aplicar e gerar o 3D" (API de desenvolvimento `POST /amostras/{tenis}/gerar`).
- Guia `docs/09-funcionalidades-cg.md`.

### Removido (27/10/2026)
- **Ampliar → "Lente (FOV)"**: o zoom de lente funcionava, mas no uso não dava para perceber a diferença para o
  "Aproximar a câmera" (nem com um slider de FOV). A aba Ampliar ficou só com o zoom que anda com a câmera, no ponto sob
  o cursor. O FOV continua no rodapé do visor. [F2-T12]

### Corrigido (20/10/2026)
- **Recorte pela câmera (near)**: o slider ia de 0 até a distância da câmera e só cortava o tênis no último terço —
  parecia não funcionar. Agora é "Cortar da frente" (0 = nada, máximo = o tênis inteiro), medido a partir do ponto do
  modelo mais próximo da câmera, e continua certo depois de girar ou dar zoom.

### Corrigido (02/10/2026)
- tenis-03 pior que 01/02: sombra suave do catálogo inchava a silhueta e manchava o bico de branco; ondas na lateral.
- Ligar o corte derrubava o visualizador; comentário de código aparecia na tela; erro ao terminar de carregar o modelo.

### Adicionado (01/10/2026 — tenis-03 e conceitos da professora)
- **Até 6 fotos**: além de lateral, topo e frente, `outro_lado`, `sola` e `tras` (opcionais). Cor real do outro lado,
  da sola e do calcanhar; registro automático quando a sola/traseira é do outro pé do par. [ADR 0007]
- **Seção transversal comum** (cilindro generalizado): o modelo sai arredondado, sem o "bico quadrado". `--sem-secao`
  volta ao visual hull puro. [ADR 0007]
- **Recorte e rotação da foto** (`ajustes.json`, matriz 3×3 de volta à original) e **contorno rastreado** de cada foto
  (Suzuki–Abe/Moore + Douglas–Peucker). [F1-T11, F1-T12]
- Página **`/fotos`**: visor 2D com zoom no cursor, pan e recorte do contorno na janela (Cohen–Sutherland /
  Sutherland–Hodgman), máscara, avisos e **editor** (girar/recortar) que gera o `ajustes.json`. [F2-T10, F3-T13/T14]
- Visualizador: **plano de corte** com tampa (stencil), **zoom no ponto** (dolly) ou de lente (FOV), **cursor rastreado**
  (raycasting) em cm e **mover/girar/aumentar** com a matriz 4×4 visível (T·R·S × S·R·T). [F2-T11, T12, T13]
- CLI `gerar --pasta` (fotos nomeadas pela vista + `ajustes.json`) e `--publicar`; `make reais` publica fotos e contornos.
- Aviso quando a foto de cima parece ter mais de um tênis (o par).

### Corrigido (01/10/2026 — tenis-03)
- A escultura usava a foto frontal espelhada em relação à cor (só aparecia em tênis assimétricos).
- Listras verticais na entressola (ruído da borda da máscara): passa-baixa de 1 voxel na SDF das silhuetas.
- Rotação reportada sempre no sentido horário (a orientação automática usava anti-horário).

### Adicionado (01/10/2026 — tenis-02)
- **Orientação automática:** foto de topo "em pé"/de ponta-cabeça é girada e lateral com o bico à esquerda é espelhada,
  pelo formato do tênis (antepé mais largo do lado do bico; cano mais alto do lado do calcanhar), com aviso ao usuário.
- **Avisos de qualidade das fotos:** tênis cortado na borda, muito pequeno/grande no quadro, sombra ou objeto extra. [F1-T06]
- **Consistência entre as vistas:** `metricas["consistencia"]` (IoU por vista e proporção da frente) com aviso quando a
  frontal diverge mais de 15 %. [F1-T07, parcial]
- `make real TENIS=tenis-02` e `make reais`; tenis-02 no seletor do visualizador.

### Mudado (01/10/2026 — tenis-02)
- **Malha sem degraus:** o visual hull agora é gerado de um campo de distância assinada (SDF) das silhuetas, e não da
  grade 0/1 desfocada; some a "escada" na superfície (erro das normais cai pela metade). [ADR 0005]
- **Escala exata:** o comprimento do modelo sai exatamente o informado (antes podia errar ~0,2 %).
- Tênis sintético mais largo no antepé (como um pé real); `tenis-exemplo.glb` regenerado.

### Corrigido (01/10/2026 — tenis-02)
- Foto de topo girada gerava um tênis de **79 cm de largura** sem nenhum aviso.
- `metricas.json` e a saída da CLI mostram acentos em vez de `\u00e3`.

### Adicionado (01/10/2026)
- **Cor por vértice:** o modelo agora sai colorido, com as cores das fotos projetadas sobre a malha (`COR_0` no .glb,
  em espaço linear). [F1-T05]
- Visualizador abre qualquer `.glb` do computador, tem seletor de modelos e mostra a cor do modelo no modo Sólido. [F2-T08]
- `make real`: gera o modelo do `samples/reais/tenis-01` em resolução 256 e abre no visualizador.

### Corrigido (01/10/2026)
- **Segmentação:** tênis escuro com solado branco em fundo claro perdia o solado (o Otsu usava só o brilho). Agora a
  máscara usa a distância de cor ao fundo (Lab) e remove a sombra de contato. [F1-T06, parcial]

### Adicionado
- Pipeline de prova de conceito sem IA: segmentação (Otsu + morfologia), alinhamento das 3 vistas, visual hull em
  voxels, Marching Cubes, exportação .glb/.obj/.stl em escala real. CLI `relevo-pipeline`. [F0-T03]
- Gerador de fotos sintéticas de um tênis para testes. [F0-T04]
- API FastAPI com `/health` e `/health/db`; Alembic configurado. [F0-T05]
- PostgreSQL + Adminer via Docker Compose. [F0-T06]
- Front React + Three.js com visualizador (sólido, wireframe, normais). [F0-T07]
- Documentação: visão, stack, arquitetura, pipeline de CG, banco, API, guia de fotos, setup, 6 fases detalhadas,
  acompanhamento, testes, revisões e ADRs.
