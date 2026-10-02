# 0005 — Visual hull com campo de distância assinada (SDF) para gerar a malha

**Data:** 2026-10-01 · **Status:** aceita (complementa a 0001; não muda a decisão D3)

## Contexto
No tenis-02 (2048 px por foto, resolução 256), a malha gerada pela escultura binária (voxel 0/1 + desfoque gaussiano
σ = 1 + Marching Cubes no nível 0,5) mostrava "terraços" em toda a superfície: cada degrau de um voxel da borda da
silhueta virava um degrau na malha e listras no sombreamento. Mais desfoque arredonda também os detalhes e as quinas;
suavização de Taubin depois do Marching Cubes quase não mudou o resultado (desvio do ângulo entre faces 4,5° → 3,5°).

## Decisão
Continuar com visual hull + Marching Cubes (D3), mas trocar o **campo** que vai para o Marching Cubes: cada silhueta
vira um **campo de distância assinada 2D** (calculado na foto em resolução cheia), estendido no eixo que a vista não vê,
e o hull é a interseção implícita `campo = max(d_lateral, d_topo, d_frente)`, com a malha no nível 0.
A escultura binária continua sendo calculada para métricas, Raio-X e explicação.

## Alternativas consideradas
- **Mais desfoque no campo 0/1** — simples; arredonda quinas e detalhes finos (cadarço, colarinho) junto com os degraus.
- **Taubin (F1-T02) sobre a malha binária** — preserva volume, mas atua depois que a informação de sub-voxel já se perdeu;
  medido: melhora pequena.
- **Aumentar a resolução** — degraus menores, mas o custo cresce com o cubo (256 → 512 = 8× memória e tempo).

## Consequências
- Erro médio das normais num cilindro conhecido: 3,3° → 1,6° (teste `test_campo_continuo_tira_os_degraus`); volume igual.
- Quinas onde duas silhuetas se cruzam ficam vivas (correto para o visual hull), por isso a métrica "desvio do ângulo
  entre faces vizinhas" sobe no sintético — não serve para medir degraus; usamos o erro de normal num sólido conhecido.
- Novo cuidado: valores exatamente iguais ao nível no campo geram triângulos degenerados — tratados com um epsilon.
- Custo: duas transformadas de distância por foto; o alinhamento das 3 fotos de 1600 px levou 0,07 s no total e o
  pipeline inteiro do tenis-02 segue < 1 s na resolução 256.
- Conceito de CG extra para a banca: funções implícitas, SDF e CSG (interseção = máximo).
