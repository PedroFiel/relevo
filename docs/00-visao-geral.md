# 00 — Visão geral do produto

## Empresa

**RELEVO** — Serviços de TI, modelo SaaS.

- **Visão:** ser referência em tornar a criação 3D acessível a qualquer pessoa, sem exigir domínio de software de modelagem.
- **Missão:** converter imagens em modelos 3D prontos para uso, em segundos, eliminando a barreira técnica e o custo da modelagem tradicional.
- **Valores:** agilidade · acessibilidade · qualidade de entrega · propriedade do criador sobre o que cria · transparência sobre os limites da tecnologia.

## Problema

Criar um modelo 3D de um produto é **caro** (R$ 150 a R$ 3.000 por peça), **lento** (dias a semanas) e **exige especialista**
(aprender Blender leva meses). As alternativas falham: bibliotecas prontas só têm o que já existe; fotogrametria exige
dezenas de fotos com iluminação controlada.

## Solução

O usuário tira **3 fotos** do calçado (lateral, de cima e de frente) em fundo liso. O RELEVO:

1. separa o calçado do fundo em cada foto (segmentação clássica);
2. alinha as três silhuetas numa grade comum;
3. esculpe um bloco de voxels mantendo só o que está dentro das três silhuetas (**Visual Hull**);
4. converte os voxels em malha de triângulos (**Marching Cubes**), suaviza e otimiza;
5. pinta a malha com as cores das fotos (projeção de textura);
6. entrega um visualizador 3D interativo e exportação em .glb, .obj e .stl, **em escala real**.

**Tudo sem IA** — requisito da disciplina e diferencial pedagógico: cada etapa é um algoritmo de CG explicável.

## Público

Lojistas de moda/calçados (e-commerce) que querem visualização 3D do produto na página; criadores que querem um
modelo base para jogos/AR; makers que querem imprimir em 3D.

## Escopo do MVP (Fases 0–3)

- Upload guiado das 3 fotos + tamanho real do calçado, com **editor de foto** (cortar, girar, ampliar)
- Processamento com status por etapa; **contorno detectado e avisos** mostrados sobre cada foto
- Visualizador 3D (rotação, zoom no ponto, sólido / wireframe / normais, **plano de corte**, mover/girar/aumentar com
  a matriz 4×4 visível)
- Download do modelo (.glb)
- Persistência em PostgreSQL (modelos, imagens, jobs, versões, arquivos)

## Depois do MVP (Fases 4–5)

Login e créditos · editor de transformações completo (pivô, desfazer, salvar versão) · exportação .obj/.stl · textura UV real ·
versões · Raio-X do pipeline · LOD · régua 3D · presets de destino · pincel de correção · link de incorporação.

## Fora de escopo (decisão consciente)

- Qualquer técnica baseada em IA/aprendizado de máquina.
- Objetos com concavidades profundas reconstruídas fielmente (limitação teórica do visual hull — ver `03-pipeline-cg.md`).
- Fotografia livre (ângulos arbitrários / calibração de câmera). Usamos 3 vistas ortogonais padronizadas.
- App mobile nativo, pagamentos reais.

## Limites que comunicamos ao usuário (valor "transparência")

- A abertura onde entra o pé fica **fechada** (concavidade não aparece em nenhuma silhueta).
- O lado oposto ao fotografado é **espelhado** da foto lateral; o solado não é fotografado.
- A qualidade depende das fotos: fundo liso e contrastante, câmera alinhada e afastada.
