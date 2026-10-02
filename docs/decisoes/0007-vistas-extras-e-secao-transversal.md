# 0007 — Até 6 vistas, registro por IoU e seção transversal comum

**Data:** 2026-10-01 · **Status:** aceita (complementa 0001 e 0005; D2 continua: lateral e topo obrigatórias)

## Contexto
O tenis-03 veio com 8 imagens de catálogo: lateral, **outro lado**, **sola**, topo e **traseira** (as duas últimas com o
par de tênis), uma 3/4 e dois detalhes. O pipeline só aceitava lateral, topo e frente, então:
- o lado oposto era a lateral **espelhada** (o logo "Flight" do outro lado nunca aparecia);
- o solado ficava **cinza neutro** e o calcanhar sem foto própria;
- com vistas só nos 3 eixos, cada fatia transversal do visual hull é praticamente um **retângulo** — o bico e as laterais
  ficam "quadrados" (limite conhecido, CLAUDE.md §13).

## Decisão
1. **Seis vistas** (`vistas.py`): `lateral`, `outro_lado`, `topo`, `sola`, `frente`, `tras`. Cada uma é levada a um de
   três **quadros canônicos** (lateral, topo, frente) pelo espelhamento físico da câmera; vistas do mesmo quadro somam
   restrições ao hull (AND / `max` das SDFs) e cada uma pinta o lado que vê (`direcao`).
2. **Registro por IoU**: a vista extra é comparada com a principal do quadro no espelhamento físico e no oposto; fica o de
   maior IoU (com margem). Detecta foto da sola/traseira tirada do **outro pé** do par e avisa o usuário.
3. **Seção transversal comum (cilindro generalizado)** — `voxel.campo_secao`: supõe que todas as fatias têm o mesmo
   perfil T escalado para a altura/largura da fatia. T = interseção robusta (≥ 90 %) das fatias do hull normalizadas;
   cada fatia vira T escalado; entra por `max` com o hull (só remove volume). Caixas das fatias contínuas e suavizadas.
4. **Passa-baixa na borda das silhuetas** (desfoque de 1 voxel na SDF 2D, na resolução da foto): o ruído de 1–3 px da
   segmentação virava listras no sombreamento.

## Alternativas consideradas
- **Usar a silhueta frontal como perfil de todas as fatias** — testado: IoU 3D no sintético caiu de 0,92 para 0,82,
  porque a frontal é a *união* das fatias (alta no calcanhar, larga no antepé), não o perfil de uma delas.
- **Superelipse fixa** (cantos arredondados por um expoente escolhido à mão) — mais simples, mas é um palpite que não
  vem das fotos; a interseção das fatias usa só os dados.
- **Usar a foto 3/4** — exigiria câmera oblíqua calibrada (fora de escopo, D2); e a do tenis-03 mostra o par sobreposto.
- **Taubin para as listras** — medido: quase não muda (as ondulações são maiores que alguns triângulos).

## Consequências
- Sintético (forma real conhecida): IoU 3D **0,923 → 0,979** com a seção; perde < 2 % do volume real (teste).
- tenis-03: cor real do outro lado, da sola e do calcanhar; forma arredondada; IoU das 5 vistas ≥ 0,95.
- A forma deixa de ser "o maior sólido compatível com as fotos" (o hull): passa a ser uma **hipótese**, ainda
  compatível com todas as silhuetas (IoU por vista reportado). `--sem-secao` / `secao=False` volta ao hull puro.
- A correção do espelhamento da frente (a escultura usava a foto frontal espelhada em relação à cor) veio junto:
  agora a convenção física de cada câmera está num lugar só (`vistas.py`).
- A API (Fase 3) aceita as 3 vistas extras como arquivos opcionais (`05-api.md`).
