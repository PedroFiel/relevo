# Fase 4 — Produto

**Objetivo:** transformar o MVP em produto SaaS: contas, créditos, edição do modelo com matrizes de transformação,
exportação em vários formatos, textura UV de verdade, versões e storage em S3.

**Depende de:** Fase 3 (MVP).
**Entrega da fase:** usuário cria conta, gasta 1 crédito para gerar, ajusta escala/rotação/pivô, salva como nova
versão, exporta `.obj`/`.stl`/`.glb` texturizado e alterna entre versões.

---

## Contas e créditos

### F4-T01 — Autenticação — **FEITO (02/11)**
- **Como ficou:** `servicos/auth.py` e `routers/auth.py` com hash `hashlib.scrypt` + sal de 16 bytes e tokens JWT HS256 (`POST /auth/registrar` com 10 créditos iniciais `boas-vindas`, `POST /auth/login`); `get_usuario_id` valida `Authorization: Bearer <token>` (e mantém fallback para `USUARIO_DEMO_ID` quando sem cabeçalho para o modo demonstração). No front, páginas `/entrar` e `/cadastrar`, persistência segura no `localStorage` e botões de Entrar / Criar conta / Sair em `/conta`.
- **Frente:** back, banco, front
- **Como fazer:**
  1. Back: `pwdlib[argon2]` para hash de senha; `pyjwt` para tokens (HS256, expiração 7 dias, segredo no `.env`).
     Rotas `/auth/registrar`, `/auth/login`, `/me`. Dependência `usuario_atual` (lê `Authorization: Bearer`) substitui o
     usuário demo em todas as rotas; recursos de outro usuário → 404.
  2. Banco: migração que torna `senha_hash` obrigatório para novos usuários (o demo continua para testes).
  3. Front: páginas `/entrar` e `/cadastrar`; token no `localStorage` (envolto em try/catch); `RotaProtegida`;
     o cliente da API adiciona o header; 401 → redireciona para `/entrar`.
- **Testes:** registrar → login → `/me`; senha errada → 401; usuário A não vê modelo de B (404).

### F4-T02 — Créditos — **FEITO (02/11)**
- **Frente:** back, banco, front
- **Como fazer:** tabela `movimentos_credito`; novo usuário ganha 10 créditos (movimento "boas-vindas"); `POST /modelos`
  debita 1 na **mesma transação** que cria o job (`SELECT ... FOR UPDATE` no usuário); sem saldo → 402; job com erro
  devolve o crédito (movimento "estorno"). Front: saldo no cabeçalho, extrato em `/conta` e recarga de demonstração (`POST /creditos/recarregar`).
- **Testes:** saldo nunca fica negativo (`CHECK creditos >= 0`); 402 quando zerado; estorno automático quando o job falha.

## Editor e versões

### F4-T03 — Editor de transformações (escala, rotação, pivô) — **FEITO (02/11)**
- **Frente:** front
- **Depende de:** F2-T13 (mover/girar/aumentar e painel da matriz já existem no MVP; aqui entram pivô, atalhos,
  desfazer e salvar versão)
- **Como fazer:**
  1. Modo "Editar" no visualizador com `TransformControls` (drei) e seletor translação/rotação/escala; campos numéricos
     sincronizados (escala uniforme em %, rotação em graus por eixo, posição em cm).
  2. **Pivô:** botão "Definir pivô" → próximo clique no modelo (raycasting) define o ponto de pivô; a rotação/escala passa a
     acontecer em torno dele: `M = T(p) · R · S · T(−p)`.
  3. **Painel "Matriz"** mostrando a matriz homogênea 4×4 resultante ao vivo (`object.matrix.elements`, formatada em
     linhas) — material direto para a apresentação.
  4. Atalhos: G/R/S (como no Blender), Esc cancela, Ctrl+Z desfaz (pilha de matrizes).
  5. "Salvar como nova versão" → `POST /modelos/{id}/versoes { transformacao: number[16] }`.
- **Testes:** `src/lib/matrizes.ts` → `composicaoComPivo(p, R, S)` comparada com a multiplicação manual; pivô no centro =
  mesmo resultado sem pivô.
- **Conceito de CG:** transformações geométricas, coordenadas homogêneas, composição e ordem de matrizes, pivô.

### F4-T04 — Versões no back — **FEITO (02/11)**
- **Frente:** back, banco, front
- **Como fazer:** `POST /modelos/{id}/versoes`: carrega o `.glb` da versão atual, aplica a matriz 4×4 com
  `malha.apply_transform`, salva nova versão + arquivo, atualiza `versao_atual` e recalcula dimensões.
  `POST /modelos/{id}/versoes/{n}/restaurar` aponta `versao_atual`. No front, a aba "Transformar" salva como nova versão e o cabeçalho do modelo permite alternar entre versões (`v1`, `v2 · 4×4`).
- **Testes:** escala 2× dobra as dimensões; restaurar volta a versão ativa.

### F4-T05 — Outros formatos no download — **FEITO (02/11)**
- **Frente:** back, front
- **Revisada (28/10, ADR 0009):** é só uma **opção no botão de download** — o modelo é gerado sempre do mesmo jeito
  (configuração única); `.glb` continua o padrão.
- **Como fazer:** `GET /versoes/{id}/exportar?formato=glb|obj|stl` — converte a malha da versão com o `exportar()` do
  pipeline e guarda em `arquivos` (cache). Front: botões `Baixar .obj` e `Baixar .stl` ao lado de `Baixar .glb` em `/modelos/:id`.
- **Testes:** cada formato abre de volta com `trimesh.load`; `.stl` é *watertight*; a malha convertida tem as mesmas
  dimensões da `.glb`.

## Textura e storage

### F4-T06 — Mapeamento UV e textura — **FEITO (02/11)**
- **Frente:** pipeline
- **Como ficou:** `packages/pipeline/src/relevo_pipeline/textura.py` (`desdobrar_uv`, `areas_uv`, `assar_textura`) projeta os triângulos em 6 ilhas ortográficas (`+Z`, `−Z`, `+Y`, `−Y`, `+X`, `−X`) empacotadas em `[0, 1]²` sem faces degeneradas, rasteriza a textura RGB e aplica dilatação morfológica por transformada de distância nas bordas das ilhas.

### F4-T07 — Modo UV no visualizador — **FEITO (02/11)**
- **Frente:** front
- **Como ficou:** modo `"Textura UV"` (`uv`) em `modosRender.ts`, `ModelViewer.tsx` e `Visualizador.tsx` com textura xadrez procedural e diagrama do atlas 2D das 6 ilhas ortográficas no painel lateral.
- **Conceito de CG:** distorção de parametrização, espaço de textura.

### F4-T08 — Storage S3 (MinIO) — **FEITO (02/11)**
- **Frente:** back
- **Como ficou:** serviço `minio` no `docker-compose.yml` + classe `S3Storage` em `apps/api/src/relevo_api/storage.py` implementando a interface `Storage` com cache local sob demanda (`STORAGE_TIPO=local|s3`).

## Encerramento da Fase 4

- [ ] Fluxo completo com conta nova gravado em vídeo
- [ ] Relatório com prints: matriz 4×4 ao vivo, atlas UV, modelo texturizado
- [ ] Revisão de fase `docs/revisoes/fase-4.md` + tag `v0.2.0`
