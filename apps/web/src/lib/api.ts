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
  tempos_s?: Record<string, number>
  decimacao?: { usada: boolean; faces_antes?: number; erro_medio_mm?: number; erro_max_mm?: number }
}

export type Versao = { numero: number; metricas: MetricasVersao | null; arquivos: Arquivo[]; criado_em: string }

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

/** URL que a API devolve (`/arquivos/…`, `/imagens/…`) → URL que o navegador usa. */
export function urlApi(caminho: string): string {
  return caminho.startsWith(BASE_API) ? caminho : `${BASE_API}${caminho}`
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(urlApi(caminho), init)
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
