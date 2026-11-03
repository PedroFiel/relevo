/**
 * Cliente da API (F3-T07). Tipos espelham `apps/api/src/relevo_api/schemas.py`; contrato em
 * docs/05-api.md. Em dev o Vite manda `/api/*` para o FastAPI (vite.config.ts).
 */
import type { AjusteFoto, Metricas, Vista } from './vistas'

export const BASE_API = '/api'

export type StatusModelo = 'rascunho' | 'processando' | 'pronto' | 'erro'
export type StatusJob = 'pendente' | 'processando' | 'concluido' | 'erro'

export type ModeloCriado = { modelo_id: string; job_id: string }

export type Job = {
  id: string
  modelo_id: string
  status: StatusJob
  etapa_atual: string | null
  progresso: number
  etapas: string[]
  erro: string | null
}

export type Imagem = { vista: Vista; largura_px: number; altura_px: number; url: string }
export type Arquivo = { id: string; tipo: string; nome: string; tamanho_bytes: number; url: string }

export type MetricasVersao = Metricas & {
  dims_voxels?: number[]
  tamanho_voxel_cm?: number
  tempos_s?: Record<string, number>
  suavizacao?: {
    usada: boolean
    iteracoes?: number
    variacao_volume_pct?: number
    rugosidade_antes_graus?: number
    rugosidade_depois_graus?: number
  }
  decimacao?: { usada: boolean; faces_antes?: number; erro_medio_mm?: number; erro_max_mm?: number }
}

export type Versao = {
  id?: string
  numero: number
  metricas: MetricasVersao | null
  transformacao?: number[] | null
  arquivos: Arquivo[]
  criado_em: string
}

export type VersaoResumo = {
  id: string
  numero: number
  transformacao?: number[] | null
  criado_em: string
}

export type MovimentoCredito = {
  id: string
  quantidade: number
  motivo: string
  job_id: string | null
  criado_em: string
}

export type Conta = {
  id: string
  nome: string
  email: string
  creditos: number
  movimentos: MovimentoCredito[]
}

export type RespostaToken = {
  access_token: string
  token_type: string
  usuario: Conta
}

export type ModeloPublico = {
  id: string
  nome: string
  comprimento_cm: number
  glb_url: string
  dimensoes_cm?: number[] | null
  faces?: number | null
  vertices?: number | null
}

export type ModeloResumo = {
  id: string
  nome: string
  status: StatusModelo
  versao_atual: number | null
  miniatura_url: string | null
  atualizado_em: string
}

export type ModeloDetalhe = {
  id: string
  nome: string
  status: StatusModelo
  comprimento_cm: number
  imagens: Imagem[]
  versao: Versao | null
  versoes?: VersaoResumo[]
  job: Job | null
  criado_em: string
  atualizado_em: string
}

export type NovoModelo = {
  nome: string
  comprimento_cm: number
  /** Só para desenvolvimento: o site não escolhe (configuração única, ADR 0009). */
  resolucao?: number
  fotos: Partial<Record<Vista, File>>
  ajustes: Partial<Record<Vista, AjusteFoto>>
}

/** Erro com a mensagem que o back escreveu para o usuário (`{"detail": "…"}`). */
export class ErroApi extends Error {
  readonly status: number
  readonly mensagem: string

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.mensagem = mensagem
  }
}

const CHAVE_TOKEN = 'relevo.jwt.v1'

export function obterToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function salvarToken(token: string): void {
  try {
    localStorage.setItem(CHAVE_TOKEN, token)
  } catch {
    /* modo privado ou storage bloqueado */
  }
}

export function limparToken(): void {
  try {
    localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* modo privado ou storage bloqueado */
  }
}

/** URL que a API devolve (`/arquivos/…`, `/imagens/…`) → URL que o navegador usa. */
export function urlApi(caminho: string): string {
  const base = caminho.startsWith(BASE_API) ? caminho : `${BASE_API}${caminho}`
  const token = obterToken()
  if (!token || base.includes('token=')) return base
  const separador = base.includes('?') ? '&' : '?'
  return `${base}${separador}token=${encodeURIComponent(token)}`
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const token = obterToken()
  const cabecalhos = new Headers(init?.headers)
  if (token && !cabecalhos.has('Authorization')) {
    cabecalhos.set('Authorization', `Bearer ${token}`)
  }
  let resposta: Response
  try {
    resposta = await fetch(urlApi(caminho), { ...init, headers: cabecalhos })
  } catch {
    throw new ErroApi(0, 'Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.')
  }
  if (!resposta.ok) throw new ErroApi(resposta.status, await mensagemDeErro(resposta))
  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  const corpo = await resposta.json().catch(() => null)
  const detalhe = corpo?.detail
  if (typeof detalhe === 'string') return detalhe
  // 422 do FastAPI: lista de campos inválidos
  if (Array.isArray(detalhe) && detalhe.length) {
    const campos = detalhe.map((d: { loc?: string[] }) => d.loc?.at(-1)).filter(Boolean)
    return `Confira estes campos: ${[...new Set(campos)].join(', ')}.`
  }
  if (resposta.status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.'
  return `Algo deu errado (erro ${resposta.status}).`
}

/** Monta o multipart do `POST /modelos` (só as vistas com foto; só os ajustes que mudam algo). */
export function formularioModelo(m: NovoModelo): FormData {
  const f = new FormData()
  f.set('nome', m.nome.trim())
  f.set('comprimento_cm', String(m.comprimento_cm))
  if (m.resolucao !== undefined) f.set('resolucao', String(m.resolucao))
  for (const [vista, arquivo] of Object.entries(m.fotos)) if (arquivo) f.set(vista, arquivo)
  const ajustes = Object.fromEntries(
    Object.entries(m.ajustes).filter(
      ([v, a]) => a && m.fotos[v as Vista] && (a.rotacao_graus % 360 !== 0 || a.recorte !== null),
    ),
  )
  if (Object.keys(ajustes).length) f.set('ajustes', JSON.stringify(ajustes))
  return f
}

export const criarModelo = (m: NovoModelo) =>
  pedir<ModeloCriado>('/modelos', { method: 'POST', body: formularioModelo(m) })
export const buscarJob = (id: string) => pedir<Job>(`/jobs/${id}`)
export const listarModelos = () => pedir<ModeloResumo[]>('/modelos')
export const buscarModelo = (id: string) => pedir<ModeloDetalhe>(`/modelos/${id}`)
export const apagarModelo = (id: string) => pedir<void>(`/modelos/${id}`, { method: 'DELETE' })
export const buscarConta = () => pedir<Conta>('/me')
export const recarregarCreditos = (quantidade = 10) =>
  pedir<Conta>(`/creditos/recarregar?quantidade=${quantidade}`, { method: 'POST' })
export const criarVersao = (modeloId: string, transformacao: number[]) =>
  pedir<Versao>(`/modelos/${modeloId}/versoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transformacao }),
  })
export const restaurarVersao = (modeloId: string, numero: number) =>
  pedir<ModeloDetalhe>(`/modelos/${modeloId}/versoes/${numero}/restaurar`, { method: 'POST' })
export const regerarModelo = (modeloId: string, mascaras: Partial<Record<Vista, string>>) =>
  pedir<ModeloCriado>(`/modelos/${modeloId}/regerar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mascaras }),
  })
export const urlExportarVersao = (versaoId: string, formato: 'glb' | 'obj' | 'stl') =>
  urlApi(`/versoes/${versaoId}/exportar?formato=${formato}`)
export const registrarUsuario = (dados: { nome: string; email: string; senha: string }) =>
  pedir<RespostaToken>('/auth/registrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
export const loginUsuario = (dados: { email: string; senha: string }) =>
  pedir<RespostaToken>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
export const buscarModeloPublico = (id: string) => pedir<ModeloPublico>(`/publico/${id}`)
