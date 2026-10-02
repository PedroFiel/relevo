# Fase 3 — Integração (fecha o MVP)

**Objetivo:** juntar as três frentes. O usuário sobe 3 fotos no site, acompanha o processamento por etapa e vê o
tênis 3D no navegador; tudo persistido no PostgreSQL.

**Depende de:** Fases 1 e 2.
**Entrega da fase (demo do MVP):** em `/novo`, enviar as fotos de `samples/reais/tenis-01` → ver as etapas avançando →
abrir o modelo colorido no visualizador → baixar o `.glb` → recarregar a página e encontrá-lo em `/modelos`.

---

## Banco

### F3-T01 — Modelos ORM e migração
- **Frente:** banco
- **Como fazer:**
  1. Em `apps/api/src/relevo_api/models.py`, criar as classes SQLAlchemy 2 (`Mapped[...]`, `mapped_column`) para
     `usuarios`, `modelos`, `imagens`, `jobs`, `versoes`, `arquivos` exatamente como em
     [04-banco-de-dados.md](../04-banco-de-dados.md): UUID (`uuid.uuid4` como default), `timestamptz` com
     `server_default=func.now()`, `JSONB` para `parametros/metricas/transformacao`, `CheckConstraint` nos status e vistas,
     `UniqueConstraint(modelo_id, vista)` e `(modelo_id, numero)`, `ForeignKey(..., ondelete="CASCADE")`, relacionamentos.
  2. `uv run alembic revision --autogenerate -m "tabelas do mvp"`; **revisar o arquivo gerado** (o autogenerate erra
     CHECKs e defaults); adicionar *seed* do usuário demo (`op.bulk_insert`) com id fixo `00000000-0000-0000-0000-000000000001`.
  3. `make migrate` e conferir no Adminer.
- **Testes:** `tests/test_models.py` (usa banco de teste `relevo_test`, ver T04): criar modelo com 3 imagens; segunda imagem
  com a mesma vista → `IntegrityError`; apagar modelo apaga imagens/jobs (cascade).
- **Aceite:** `alembic downgrade base && alembic upgrade head` funciona ida e volta.

### F3-T02 — Storage local
- **Frente:** back
- **Como fazer:** `storage.py` com `class Storage(Protocol)`: `salvar(chave, bytes) -> str`, `abrir(chave) -> bytes`,
  `caminho_local(chave) -> Path`, `apagar_prefixo(prefixo)`. Implementação `LocalStorage(settings.storage_dir)`.
  Chaves: `modelos/{modelo_id}/fotos/{vista}.{ext}`, `modelos/{modelo_id}/v{n}/modelo.glb`, `.../etapas/...`.
- **Testes:** salvar/abrir/apagar em `tmp_path`; chave com `..` é rejeitada (segurança contra *path traversal*).

## Back-end

### F3-T03 — Schemas e endpoint de criação
- **Frente:** back
- **Depende de:** T01, T02
- **Como fazer:**
  1. `schemas.py` (Pydantic): `ModeloCriadoOut`, `ModeloResumoOut`, `ModeloDetalheOut`, `JobOut`, `ArquivoOut`.
  2. `routers/modelos.py` → `POST /modelos` conforme [05-api.md](../05-api.md): validar tipo (ler os primeiros bytes:
     assinatura JPEG `FF D8` / PNG `89 50 4E 47`), tamanho ≤ 10 MB, `comprimento_cm` 5–60; decodificar com
     `cv2.imdecode` para garantir que é imagem válida e obter largura/altura.
  3. Em uma transação: criar `modelo` (status `processando`), `imagens`, `job` (status `pendente`, `parametros` do preset).
  4. `background_tasks.add_task(executar_job, job_id)`; responder **202**.
- **Testes:** `httpx`/`TestClient` com as fotos sintéticas → 202 e linhas no banco; sem `topo` → 422; arquivo `.txt`
  renomeado para `.jpg` → 400; 11 MB → 413.

### F3-T04 — Banco de teste e fixtures
- **Frente:** back
- **Como fazer:** `tests/conftest.py`: cria a base `relevo_test` se não existir, roda `alembic upgrade head` nela uma vez
  por sessão, e cada teste roda dentro de uma transação revertida no fim (*rollback*). Sobrescrever `get_db` e o
  Storage (`tmp_path`) via `app.dependency_overrides`. No CI, adicionar `services: postgres:16` ao job Python.
- **Aceite:** `make test-py` roda isolado e repetível; CI verde.

### F3-T05 — Execução do job
- **Frente:** back
- **Depende de:** T03, F1-T08
- **Como fazer:**
  1. `servicos/processamento.py` → `executar_job(job_id)`: abre **sessão própria** (não reutilizar a da requisição);
     marca `processando` + `iniciado_em`; carrega as fotos do Storage; chama `processar(..., ao_progredir=cb)` onde `cb`
     faz `UPDATE jobs SET etapa_atual, progresso` e `commit` a cada etapa.
  2. Sucesso: salva `modelo.glb` (e intermediários), cria `versoes` (numero = max+1) e `arquivos`, grava `metricas`,
     `job.status = concluido`, `modelo.status = pronto`, `modelo.versao_atual = numero`.
  3. Erro: captura a exceção, `job.status = erro`, `job.erro = mensagem amigável` (ex.: "Não encontramos o tênis na
     foto de topo — o fundo tem contraste suficiente?"), `modelo.status = erro`. Log com *traceback*.
  4. No *startup* da API (`lifespan`): jobs `processando` viram `erro` ("interrompido").
- **Testes:** executar job com fotos sintéticas → versão 1 com `.glb` existente e métricas; foto toda branca → status
  `erro` com mensagem; callback grava etapas em ordem.

### F3-T06 — Endpoints de leitura
- **Frente:** back
- **Como fazer:** `GET /jobs/{id}`, `GET /modelos`, `GET /modelos/{id}`, `GET /arquivos/{id}/download`
  (`FileResponse` com `media_type` certo), `DELETE /modelos/{id}` (apaga Storage também). 404 para id inexistente
  ou de outro usuário.
- **Testes:** cada rota: caso feliz + 404; download devolve bytes que o `trimesh.load` abre.

## Front-end

### F3-T07 — Cliente da API
- **Frente:** front
- **Como fazer:** `src/lib/api.ts`: tipos TypeScript espelhando os schemas; funções `criarModelo(FormData)`,
  `buscarJob(id)`, `listarModelos()`, `buscarModelo(id)`, `apagarModelo(id)`; erros viram `ErroApi { status, mensagem }`.
  Hooks TanStack Query em `src/lib/consultas.ts`.
- **Testes:** Vitest com `fetch` *mockado*: monta a URL certa, converte erro 400 em `ErroApi`.

### F3-T08 — Página "Novo modelo" (upload guiado)
- **Frente:** front
- **Como fazer:**
  1. Três `UploadSlot` (Lateral*, De cima*, Frontal) — cada um com **gabarito SVG** da silhueta esperada e a dica da vista
     (textos do [guia de fotos](../06-guia-de-fotos.md)); aceita clique ou arrastar; mostra miniatura; valida tipo/tamanho no cliente.
  2. Campos: nome, tamanho real (cm) com dica "meça com fita métrica do calcanhar ao bico"; seletor de preset (padrão e-commerce).
  3. **Prévia da silhueta no navegador** (opcional, recomendado): limiarização simples em `<canvas>` para o usuário ver
     se o fundo está sendo separado antes de enviar.
  4. Em cada foto, botão **"Ajustar"** abre o editor da F3-T13 (cortar, girar, ampliar).
  5. Enviar → `useMutation(criarModelo)` → navegar para `/modelos/:id`.
- **Testes:** botão "Gerar" desabilitado sem lateral e topo; arquivo > 10 MB mostra erro.
- **Conceito de CG:** limiarização em tempo real no cliente (pixel a pixel no `ImageData`).

### F3-T09 — Status do processamento
- **Frente:** front
- **Como fazer:** em `/modelos/:id`, enquanto `status = processando`: componente `EtapasJob` com a lista de etapas
  (✓ concluída, ● atual com animação, ○ pendente) + barra de progresso; `useQuery(buscarJob, { refetchInterval: 1000 })`
  parando quando `concluido`/`erro`. Em erro: mensagem do back + botão "Tentar com outras fotos".
- **Testes:** `EtapasJob` marca corretamente as etapas dado `etapa_atual`.

### F3-T10 — Detalhe do modelo + visualizador integrado
- **Frente:** front
- **Como fazer:** quando pronto, `/modelos/:id` mostra o `ModelViewer` (Fase 2) com a URL do `.glb` da API, as 3 fotos
  originais em miniatura, métricas (faces, dimensões, tempo) e botão **Baixar .glb**.

### F3-T11 — "Meus modelos"
- **Frente:** front
- **Como fazer:** `/modelos`: grade de cartões (nome, status, data); miniatura = primeira foto (a captura 3D vira F5);
  ação apagar com confirmação.

### F3-T13 — Editor da foto no upload: cortar, girar e ampliar
- **Status (01/10):** front pronto na página `/fotos` (gera o `ajustes.json` lido pelo pipeline); falta plugar no
  upload (F3-T08) e a validação no back (F3-T03).
- **Frente:** front, back
- **Depende de:** F2-T10, F1-T11
- **Como fazer:**
  1. Front: o `VisorFoto` (F2-T10) em modo edição: retângulo de recorte com alças (arrastar ao contrário normaliza o
     retângulo; ele é sempre **recortado contra os limites da foto**), botões girar 90° ↺/↻, zoom/pan para acertar a
     borda, "Restaurar". A miniatura do upload mostra a foto já ajustada.
  2. O formulário envia o campo `ajustes` (JSON) — ver [05-api.md](../05-api.md).
  3. Back: valida `ajustes` (vistas conhecidas, rotação ∈ {0, 90, 180, 270}, recorte dentro da foto após a rotação,
     ≥ 64 px) → 422 com mensagem amigável; guarda em `jobs.parametros` (JSONB, **sem migração**) e repassa para
     `processar(..., ajustes=...)`.
- **Testes:** front — `normalizarRetangulo` e `limitarAImagem` (puros); recorte arrastado para fora fica no limite.
  Back — `ajustes` inválido → 422; job recebe os ajustes; foto com segundo objeto + recorte → modelo sem o aviso.
- **Aceite:** com a foto de topo "em pé" do tenis-02, girar no editor dá o mesmo modelo da orientação automática.
- **Conceito de CG:** janela de recorte, transformações 2D interativas (o mesmo pipeline janela→viewport da F2-T10).

### F3-T14 — Segmentação e contorno visíveis no resultado
- **Status (01/10):** front pronto na página `/fotos` lendo o `metricas.json` publicado por `make reais`; falta ler da
  API (F3-T10).
- **Frente:** front, back
- **Depende de:** F1-T12, F2-T10, T10
- **Como fazer:**
  1. Back: `metricas` da versão já trazem `contornos`, `ajustes`, `orientacao` e `avisos` (pipeline) — expor no
     `GET /modelos/{id}` (nada novo no banco: `versoes.metricas` é JSONB).
  2. Front: em `/modelos/:id`, aba **"Fotos"**: cada foto original no `VisorFoto` com o **contorno rastreado** por cima
     (recortado na janela com Sutherland–Hodgman ao ampliar), toggle "máscara" (preenchimento semitransparente) e a lista
     de **avisos** em linguagem simples (ex.: "Giramos a foto de topo em 90°…").
- **Testes:** componente `ListaAvisos` (vazia → "Nenhum problema nas fotos"); desenho do contorno usa a matriz `M`
  (teste da função pura que converte contorno → coordenadas de tela).
- **Aceite:** no tenis-02 o contorno das 3 fotos encosta na borda do tênis ao ampliar 8×; o aviso de rotação aparece.
- **Conceito de CG:** segmentação, rastreamento de contorno, recorte de polígonos, transparência (composição alfa).

## Qualidade

### F3-T12 — Teste ponta a ponta do MVP
- **Frente:** todas
- **Como fazer:** Playwright `e2e/mvp.spec.ts`: sobe API + web (ou usa `webServer` do Playwright), faz upload das
  fotos sintéticas (uma delas com recorte e rotação pelo editor da T13), espera "pronto" (timeout 60 s), confere que o
  canvas aparece, que a aba "Fotos" mostra o contorno e que o download responde 200.
- **Aceite:** passa localmente; roteiro manual de demo escrito em `docs/revisoes/fase-3.md`.

## Encerramento da Fase 3 = MVP

- [ ] Demo gravada em vídeo curto (backup para a apresentação)
- [ ] Relatório de testes com os tênis reais via site
- [ ] Revisão de fase `docs/revisoes/fase-3.md` + tag git `v0.1.0-mvp`
