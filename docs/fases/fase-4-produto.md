# Fase 4 — Produto

**Objetivo:** transformar o MVP em produto SaaS: contas, créditos, edição do modelo com matrizes de transformação,
exportação em vários formatos, textura UV de verdade, versões e storage em S3.

**Depende de:** Fase 3 (MVP).
**Entrega da fase:** usuário cria conta, gasta 1 crédito para gerar, ajusta escala/rotação/pivô, salva como nova
versão, exporta `.obj`/`.stl`/`.glb` texturizado e alterna entre versões.

---

## Contas e créditos

### F4-T01 — Autenticação
- **Frente:** back, banco, front
- **Como fazer:**
  1. Back: `pwdlib[argon2]` para hash de senha; `pyjwt` para tokens (HS256, expiração 7 dias, segredo no `.env`).
     Rotas `/auth/registrar`, `/auth/login`, `/me`. Dependência `usuario_atual` (lê `Authorization: Bearer`) substitui o
     usuário demo em todas as rotas; recursos de outro usuário → 404.
  2. Banco: migração que torna `senha_hash` obrigatório para novos usuários (o demo continua para testes).
  3. Front: páginas `/entrar` e `/cadastrar`; token no `localStorage` (envolto em try/catch); `RotaProtegida`;
     o cliente da API adiciona o header; 401 → redireciona para `/entrar`.
- **Testes:** registrar → login → `/me`; senha errada → 401; usuário A não vê modelo de B (404).

### F4-T02 — Créditos
- **Frente:** back, banco, front
- **Como fazer:** tabela `movimentos_credito`; novo usuário ganha 10 créditos (movimento "boas-vindas"); `POST /modelos`
  debita 1 na **mesma transação** que cria o job (`SELECT ... FOR UPDATE` no usuário); sem saldo → 402; job com erro
  devolve o crédito (movimento "estorno"). Front: saldo no cabeçalho, extrato em `/conta`.
- **Testes:** saldo nunca fica negativo com 2 requisições simultâneas (teste com threads); estorno em erro.

## Editor e versões

### F4-T03 — Editor de transformações (escala, rotação, pivô)
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

### F4-T04 — Versões no back
- **Frente:** back, banco
- **Como fazer:** `POST /modelos/{id}/versoes`: carrega o `.glb` da versão atual, aplica a matriz com
  `malha.apply_transform(np.array(m).reshape(4,4).T)` (Three.js é *column-major*), salva nova versão + arquivo, atualiza
  `versao_atual`. `GET /modelos/{id}/versoes` lista; `POST /modelos/{id}/versoes/{n}/restaurar` aponta `versao_atual`.
- **Testes:** escala 2× dobra as dimensões; rotação de 90° em y troca comprimento e largura; restaurar volta o arquivo.

### F4-T05 — Exportação multi-formato
- **Frente:** back, front
- **Como fazer:** `GET /versoes/{id}/exportar?formato=glb|obj|stl` — gera sob demanda com o `exportar()` do pipeline e
  guarda em `arquivos` (cache). `.stl` sem cor; `.obj` com `.mtl` e textura num `.zip`. Front: menu "Exportar".
- **Testes:** cada formato abre de volta com `trimesh.load`; `.stl` é *watertight*.

## Textura e storage

### F4-T06 — Mapeamento UV e textura
- **Frente:** pipeline
- **Como fazer:**
  1. `textura.py`: `vmapping, indices, uvs = xatlas.parametrize(vertices, faces)` → nova malha com UVs.
  2. Criar imagem de textura 1024×1024; para cada triângulo no espaço UV, rasterizar (coordenadas baricêntricas) e, para
     cada texel, calcular o ponto 3D e a normal interpolados → amostrar as fotos com os mesmos pesos da cor por vértice (F1-T05).
     Vetorizar: gerar a lista de texels cobertos de uma vez com NumPy.
  3. *Dilatação* da textura (2–4 px) nas bordas das ilhas UV para evitar costuras.
  4. Material `trimesh.visual.material.PBRMaterial(baseColorTexture=imagem, roughnessFactor=0.8)`; exportar `.glb`.
  5. Preset e-commerce passa a usar textura em vez de cor por vértice.
- **Testes:** UVs dentro de [0,1]; nenhuma face com área UV zero; textura sem pixels "pretos" dentro das ilhas.
- **Conceito de CG:** parametrização de superfícies, atlas UV, coordenadas baricêntricas, *texture baking*, PBR.

### F4-T07 — Modo UV no visualizador
- **Frente:** front
- **Como fazer:** modo "UV" com textura **xadrez** procedural (`CanvasTexture`) — quadrados iguais = pouca distorção;
  painel lateral mostrando o atlas 2D (desenhar os triângulos UV num `<canvas>` a partir de `geometry.attributes.uv`).
- **Conceito de CG:** distorção de parametrização, espaço de textura.

### F4-T08 — Storage S3 (MinIO)
- **Frente:** back
- **Como fazer:** serviço `minio` no `docker-compose.yml`; `S3Storage` com `boto3` implementando o mesmo `Storage`;
  escolher pelo `.env` (`STORAGE_TIPO=local|s3`); downloads via *URL pré-assinada* (expira em 1 h).
- **Testes:** mesma suíte do `LocalStorage` parametrizada para as duas implementações (S3 com `moto` em memória).

## Encerramento da Fase 4

- [ ] Fluxo completo com conta nova gravado em vídeo
- [ ] Relatório com prints: matriz 4×4 ao vivo, atlas UV, modelo texturizado
- [ ] Revisão de fase `docs/revisoes/fase-4.md` + tag `v0.2.0`
