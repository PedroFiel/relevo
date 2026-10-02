# 06 — Guia de fotos

Este texto vira a **tela de ajuda** do upload. A qualidade do modelo depende quase só das fotos.

## Regras de ouro

1. **Fundo liso e contrastante.** Tênis claro → fundo escuro (cartolina preta). Tênis escuro → fundo claro.
2. **Câmera afastada + zoom.** Afaste ~1,5 m e use o zoom 2× ou 3×. Isso reduz a perspectiva (o algoritmo assume
   vista *ortográfica*: objetos de frente, sem "efeito de profundidade").
3. **Câmera alinhada.** Na lateral, a lente na altura do meio do tênis. No topo, exatamente de cima.
4. **Tênis inteiro no quadro**, com margem, sem cortar nada.
5. **Luz difusa**, sem sombra forte no chão (sombra vira "parte do tênis").
6. **Sem cadarço solto** pendurado para fora da silhueta.

## As vistas

| Vista | Como posicionar | Na foto |
|---|---|---|
| **Lateral** (obrigatória) | Tênis de lado, câmera na altura dele | calcanhar à **esquerda**, bico à **direita** |
| **De cima** (obrigatória) | Câmera exatamente acima, apontando para baixo | calcanhar à **esquerda**, bico à **direita** |
| **Frontal** (recomendada) | Câmera olhando o bico, na altura do tênis | bico de frente para a câmera |
| **Traseira** (opcional) | Câmera olhando o calcanhar, na altura do tênis | calcanhar de frente para a câmera |
| **Outro lado** (opcional) | Vire a câmera para o outro lado do tênis | o calcanhar aparece à **direita** (é natural) |
| **Sola** (opcional) | Tênis de cabeça para baixo, câmera de cima | qualquer sentido — giramos sozinhos |

**Um tênis por foto.** Foto do par atrapalha (os dois viram um objeto só, ou o maior "ganha"). Se só tiver a foto do
par, use **Ajustar → Recortar** para deixar só um. As fotos opcionais deixam o modelo melhor: o outro lado e a sola
ficam com a cor real (sem elas, o outro lado é a lateral espelhada e a sola fica cinza) e a traseira ajuda a arredondar
o formato. Se a sola ou a traseira for do outro pé do par, o RELEVO percebe, espelha e avisa.

## Por que mais de uma

Cada foto mostra só duas medidas: a lateral mostra comprimento e altura; a de cima, comprimento e largura;
a frontal (ou a traseira), largura e altura. O RELEVO cruza as fotos para descobrir a forma 3D. Sem frontal nem
traseira o modelo fica mais "quadrado" na seção transversal.

## O que esperar (transparência)

- A abertura onde entra o pé aparece **fechada**.
- Sem a foto do outro lado, o lado de dentro usa a foto do lado de fora espelhada.
- Sem a foto da sola, o solado aparece com cor neutra.
- O formato da seção transversal (o "arredondado" do tênis visto de frente) é estimado a partir das fotos: supomos
  que todas as fatias têm o mesmo perfil, só mudando de tamanho.
- Se a foto de topo vier "em pé" ou de ponta-cabeça (ou a lateral com o bico à esquerda), o RELEVO **gira/espelha
  sozinho** pelo formato do tênis e avisa o que fez. Se o formato não deixar claro, ele avisa para você conferir.
- Depois do processamento aparecem **avisos** quando algo na foto atrapalha: tênis cortado na borda, muito pequeno
  ou grande no quadro, sombra/objeto extra, ou a foto frontal com proporção diferente das outras (perspectiva).
