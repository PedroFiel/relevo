/** Regras do upload (F3-T08) e das etapas do processamento (F3-T09) — funções puras, testadas. */
import type { StatusModelo } from './api'
import type { Vista } from './vistas'

export const TAMANHO_MAXIMO = 10 * 1024 * 1024 // o mesmo limite da API
const TIPOS_ACEITOS = ['image/jpeg', 'image/png']

export const VISTAS_PRINCIPAIS: Vista[] = ['lateral', 'topo', 'frente']
export const VISTAS_EXTRAS: Vista[] = ['outro_lado', 'sola', 'tras']
export const OBRIGATORIAS: Vista[] = ['lateral', 'topo']

/** Dica curta de cada vista (do guia de fotos). */
export const DICAS: Record<Vista, string> = {
  lateral: 'De lado, câmera na altura do tênis. Calcanhar à esquerda, bico à direita.',
  topo: 'Câmera exatamente acima. Calcanhar à esquerda, bico à direita.',
  frente: 'Olhando o bico, câmera na altura do tênis.',
  outro_lado: 'O outro lado: o calcanhar fica à direita (é natural).',
  sola: 'Tênis de cabeça para baixo, câmera de cima. Qualquer sentido.',
  tras: 'Olhando o calcanhar, câmera na altura do tênis.',
}

/** Mensagem do problema com o arquivo, ou null se pode enviar. A API confere de novo pelos bytes. */
export function validarFoto(arquivo: Pick<File, 'type' | 'size' | 'name'>): string | null {
  const porNome = /\.(jpe?g|png)$/i.test(arquivo.name)
  if (!TIPOS_ACEITOS.includes(arquivo.type) && !porNome) {
    return 'Essa foto não é JPEG nem PNG. Escolha uma foto nesses formatos.'
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    const mb = (arquivo.size / 1024 / 1024).toFixed(1).replace('.', ',')
    return `A foto tem ${mb} MB; o limite é 10 MB. Diminua a resolução ou envie em JPEG.`
  }
  return null
}

export type CamposModelo = { nome: string; comprimento_cm: number | ''; fotos: Partial<Record<Vista, File>> }

/** O que falta para poder gerar (vazio = pode). */
export function pendencias(c: CamposModelo): string[] {
  const faltas: string[] = []
  if (!c.fotos.lateral) faltas.push('a foto lateral')
  if (!c.fotos.topo) faltas.push('a foto de cima')
  if (!c.nome.trim()) faltas.push('um nome')
  if (c.comprimento_cm === '' || c.comprimento_cm < 5 || c.comprimento_cm > 60) faltas.push('o comprimento (5 a 60 cm)')
  return faltas
}

// ---------- Etapas do processamento (F3-T09) ----------
export const ROTULOS_ETAPAS: Record<string, string> = {
  segmentacao: 'Separar o tênis do fundo',
  alinhamento: 'Alinhar as fotos',
  visual_hull: 'Esculpir o volume',
  marching_cubes: 'Gerar a malha',
  decimacao: 'Simplificar a malha',
  suavizacao: 'Suavizar a malha',
  cor: 'Colorir com as fotos',
  exportacao: 'Salvar o arquivo 3D',
}

export type EstadoEtapa = 'feita' | 'atual' | 'pendente' | 'falhou'

/** Situação de cada etapa a partir do job: antes da atual = feita; depois = pendente. */
export function estadoDasEtapas(
  etapas: string[],
  etapaAtual: string | null,
  status: 'pendente' | 'processando' | 'concluido' | 'erro',
): { id: string; rotulo: string; estado: EstadoEtapa }[] {
  const atual = etapaAtual ? etapas.indexOf(etapaAtual) : -1
  return etapas.map((id, i) => {
    let estado: EstadoEtapa
    if (status === 'concluido') estado = 'feita'
    else if (i < atual) estado = 'feita'
    else if (i === atual) estado = status === 'erro' ? 'falhou' : 'atual'
    else estado = 'pendente'
    return { id, rotulo: ROTULOS_ETAPAS[id] ?? id, estado }
  })
}

/** Rótulo e tom da etiqueta de cada status de modelo (página do modelo e "Meus modelos"). */
export const STATUS: Record<StatusModelo, { rotulo: string; tom: 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'info' }> = {
  rascunho: { rotulo: 'rascunho', tom: 'neutro' },
  processando: { rotulo: 'processando', tom: 'info' },
  pronto: { rotulo: 'pronto', tom: 'sucesso' },
  erro: { rotulo: 'erro', tom: 'erro' },
}
