/**
 * Raio-X do pipeline (F5-T01): as etapas que dá para mostrar de um modelo, na ordem do pipeline,
 * cada uma com a explicação curta do algoritmo (é o roteiro da demo para a banca).
 */
import type { Arquivo, Imagem, MetricasVersao } from './api'
import { VISTAS_PRINCIPAIS, VISTAS_EXTRAS } from './upload'

export type IdPasso = 'fotos' | 'mascaras' | 'voxels' | 'bruta' | 'decimada' | 'final'
export type Passo = { id: IdPasso; titulo: string; conceito: string; legenda: string; tipo: '2d' | '3d' }

const ORDEM_VISTAS = [...VISTAS_PRINCIPAIS, ...VISTAS_EXTRAS]
const num = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR')

export type ArquivosRaioX = {
  glb?: Arquivo
  voxels?: Arquivo
  bruta?: Arquivo
  mascaras: { vista: string; arquivo: Arquivo }[]
}

/** Separa os arquivos da versão pelo papel no Raio-X (nomes gravados pela API, F5-T01). */
export function arquivosDoRaioX(arquivos: Arquivo[]): ArquivosRaioX {
  const mascaras = arquivos
    .filter((a) => a.tipo === 'mascara')
    .map((a) => ({ vista: a.nome.replace(/^mascara-/, '').replace(/\.png$/, ''), arquivo: a }))
    .sort((a, b) => ORDEM_VISTAS.indexOf(a.vista as never) - ORDEM_VISTAS.indexOf(b.vista as never))
  return {
    glb: arquivos.find((a) => a.tipo === 'glb'),
    voxels: arquivos.find((a) => a.nome === 'voxels.glb'),
    bruta: arquivos.find((a) => a.nome === 'malha-bruta.glb'),
    mascaras,
  }
}

/** Etapas disponíveis (um modelo antigo, sem intermediários, mostra só fotos e o final). */
export function passosDoRaioX(imagens: Imagem[], a: ArquivosRaioX, m: MetricasVersao | null): Passo[] {
  const passos: Passo[] = []
  if (imagens.length) {
    passos.push({
      id: 'fotos',
      titulo: 'Fotos',
      conceito: 'Entrada',
      tipo: '2d',
      legenda: `${imagens.length} fotos em vistas ortogonais. Cada uma só mostra duas medidas do tênis — a lateral, comprimento e altura; a de cima, comprimento e largura. Nenhuma tem profundidade.`,
    })
  }
  if (a.mascaras.length) {
    passos.push({
      id: 'mascaras',
      titulo: 'Silhuetas',
      conceito: 'Segmentação',
      tipo: '2d',
      legenda: 'Cada pixel vira tênis (branco) ou fundo (preto) pela distância de cor ao fundo no espaço Lab; a morfologia matemática fecha os buracos e tira o ruído. As fotos já estão giradas e recortadas.',
    })
  }
  if (a.voxels) {
    passos.push({
      id: 'voxels',
      titulo: 'Voxels',
      conceito: 'Visual hull',
      tipo: '3d',
      legenda: `O espaço vira uma grade de ${(m?.dims_voxels ?? []).join(' × ')} cubinhos. Fica só o cubo que cai dentro da silhueta em TODAS as fotos — a escultura do "casco visual". Aqui aparece só a casca, um cubo por voxel, desenhados de uma vez com instancing. Os cantos retos são o limite do método; a próxima etapa arredonda com a seção transversal.`,
    })
  }
  if (a.bruta) {
    passos.push({
      id: 'bruta',
      titulo: 'Malha bruta',
      conceito: 'Marching Cubes',
      tipo: '3d',
      legenda: `O campo de distância das silhuetas — já arredondado pela seção transversal comum — vira triângulos: cada célula 2×2×2 consulta uma tabela de 256 casos. Saem ${num(m?.decimacao?.faces_antes)} faces, já fechadas e em escala real.`,
    })
  }
  if (a.glb) {
    if (m?.decimacao?.usada) {
      passos.push({
        id: 'decimada',
        titulo: 'Decimada',
        conceito: 'Erro quádrico',
        tipo: '3d',
        legenda: `Colapsa as arestas que menos mudam a forma (métrica de Garland–Heckbert): ${num(m.decimacao.faces_antes)} → ${num(m.faces)} faces, com erro médio de ${String(m.decimacao.erro_medio_mm ?? 0).replace('.', ',')} mm. O arquivo fica leve para a loja.`,
      })
    }
    passos.push({
      id: 'final',
      titulo: 'Final',
      conceito: 'Cor por vértice',
      tipo: '3d',
      legenda: 'Cada vértice é projetado de volta nas fotos e pega a cor de quem o vê mais de frente (peso pela normal). Pronto: modelo fechado, colorido e no tamanho real.',
    })
  }
  return passos
}

export const INTERVALO_APRESENTACAO_MS = 4000
