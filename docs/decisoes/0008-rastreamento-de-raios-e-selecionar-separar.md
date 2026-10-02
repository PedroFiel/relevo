# 0008 — "Rastrear" = rastreamento de raios; selecionar área, separar e mover; estúdio único

**Data:** 2026-10-02 · **Status:** aceita (complementa a 0006)

## Contexto
Na revisão com o grupo: (1) o usuário não achou as ferramentas (ficavam abaixo do modelo) e entendeu que elas "não
estavam no 3D"; (2) a pesquisa nas ementas de CG em português mostrou que "rastreamento", nesse contexto, é quase sempre
**rastreamento de raios** (ray tracing) — não rastreamento de contorno; (3) a professora mencionou **selecionar uma área,
recortá-la e poder mexer nela**, operação padrão de editores 2D (seleção retangular → recortar → mover) e 3D (Blender
`B` + `P` → Separar; Meshmixer Select → Separate) e a própria definição de recorte com "janela de seleção"; (4) o
recorte da foto só gerava um JSON e o 3D não mudava. Fontes em `docs/09-funcionalidades-cg.md`.

## Decisão
1. **Estúdio**: ferramentas em abas AO LADO do modelo (Ampliar · Recortar · Selecionar e mover · Transformar · Rastrear
   raios), cada uma com "Como funciona (CG)"; abas Modelo 3D | Fotos 2D no topo.
2. **Rastreamento de raios** (F2-T15) implementado por nós (BVH + Möller–Trumbore + raio de sombra + Lambert), lado a
   lado com a rasterização, com modo passo a passo e explicação do raio de qualquer pixel clicado.
3. **Selecionar e mover** (F2-T14): retângulo na tela → 4 planos → Sutherland–Hodgman 3D nos triângulos → a parte vira
   uma malha com matriz própria (gizmo).
4. **Recorte 3D completo**: além do plano de corte, o plano *near* da câmera (recorte pelo frustum) com slider.
5. **API de desenvolvimento** `POST /amostras/{tenis}/gerar`: o editor de fotos grava o `ajustes.json`, roda o pipeline
   e republica o modelo ("Aplicar e gerar o 3D").

## Alternativas consideradas
- **Biblioteca pronta** (three-mesh-bvh, r3f-cutter) — menos código, mas esconde exatamente o que a disciplina quer ver.
- **Seleção por pincel** (Meshmixer) — mais flexível; o retângulo usa recorte por planos, que é o conteúdo pedido.
- **Ray tracing na GPU (shader)** — mais rápido, bem mais difícil de explicar e depurar; a versão em CPU roda em ~1 s.

## Consequências
- Rastreamento de raios em CPU é ~1–2 s por imagem em meia resolução: bom para demonstração, não para tempo real.
- A peça separada fica aberta no corte (sem tampa).
- A rota `/amostras` é de desenvolvimento (lê/grava `samples/reais/`): some ou fica atrás de flag quando o upload real
  (F3-T03) existir.
