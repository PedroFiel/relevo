/**
 * Guia de fotos (fonte: docs/06-guia-de-fotos.md). Fica em dados para a página /guia e, na F3-T08,
 * para a ajuda do upload. Mudou o guia? Mude os dois.
 */
export const REGRAS_DE_OURO: { titulo: string; texto: string }[] = [
  { titulo: 'Fundo liso e contrastante', texto: 'Tênis claro → fundo escuro (cartolina preta). Tênis escuro → fundo claro.' },
  {
    titulo: 'Câmera afastada + zoom',
    texto: 'Afaste uns 1,5 m e use o zoom 2× ou 3×. Isso tira o "efeito de profundidade" que distorce o modelo.',
  },
  { titulo: 'Câmera alinhada', texto: 'Na lateral, a lente na altura do meio do tênis. No topo, exatamente de cima.' },
  { titulo: 'Tênis inteiro no quadro', texto: 'Com margem, sem cortar nada.' },
  { titulo: 'Luz difusa', texto: 'Sem sombra forte no chão — a sombra vira "parte do tênis".' },
  { titulo: 'Sem cadarço solto', texto: 'Nada pendurado para fora da silhueta.' },
]

export type VistaGuia = { nome: string; exigencia: 'obrigatória' | 'recomendada' | 'opcional'; como: string; naFoto: string }

export const VISTAS_GUIA: VistaGuia[] = [
  { nome: 'Lateral', exigencia: 'obrigatória', como: 'Tênis de lado, câmera na altura dele', naFoto: 'calcanhar à esquerda, bico à direita' },
  { nome: 'De cima', exigencia: 'obrigatória', como: 'Câmera exatamente acima, apontando para baixo', naFoto: 'calcanhar à esquerda, bico à direita' },
  { nome: 'Frontal', exigencia: 'recomendada', como: 'Câmera olhando o bico, na altura do tênis', naFoto: 'bico de frente para a câmera' },
  { nome: 'Traseira', exigencia: 'opcional', como: 'Câmera olhando o calcanhar, na altura do tênis', naFoto: 'calcanhar de frente para a câmera' },
  { nome: 'Outro lado', exigencia: 'opcional', como: 'Vire a câmera para o outro lado do tênis', naFoto: 'o calcanhar aparece à direita (é natural)' },
  { nome: 'Sola', exigencia: 'opcional', como: 'Tênis de cabeça para baixo, câmera de cima', naFoto: 'qualquer sentido — giramos sozinhos' },
]

/** O que o algoritmo não consegue (CLAUDE.md §13) — dito antes, não escondido. */
export const LIMITES: string[] = [
  'A abertura onde entra o pé aparece fechada.',
  'Sem a foto do outro lado, o lado de dentro usa a foto do lado de fora espelhada.',
  'Sem a foto da sola, o solado aparece com cor neutra.',
  'O formato visto de frente é estimado: supomos que todas as fatias do tênis têm o mesmo perfil.',
  'Tênis claro em fundo claro (ou escuro em escuro) separa mal do fundo.',
]
