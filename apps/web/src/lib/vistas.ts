/** As vistas que o pipeline entende (espelho de packages/pipeline/.../vistas.py). */
export type Vista = 'lateral' | 'outro_lado' | 'topo' | 'sola' | 'frente' | 'tras'

export const ROTULOS: Record<Vista, string> = {
  lateral: 'Lateral',
  outro_lado: 'Outro lado',
  topo: 'De cima',
  sola: 'Sola (de baixo)',
  frente: 'Frontal (bico)',
  tras: 'Traseira (calcanhar)',
}

export type AjusteFoto = { rotacao_graus: number; recorte: [number, number, number, number] | null }

/** Métricas publicadas pelo pipeline (`metricas.json`) — só o que a página de fotos usa. */
export type Metricas = {
  vistas: Vista[]
  dimensoes_cm: [number, number, number]
  faces: number
  fechada: boolean
  avisos: string[]
  consistencia: Record<string, number>
  secao?: { usada: boolean; volume_removido_pct?: number }
  orientacao: Record<string, { rotacao_graus: number; espelhada: boolean; confiante: boolean }>
  ajustes: Record<string, AjusteFoto & { matriz: number[][] }>
  contornos: Record<string, { pontos: [number, number][]; perimetro_px: number; area_px: number }>
}

/** Só as vistas que o usuário mexeu entram no ajustes.json (o mesmo formato do pipeline). */
export function ajustesParaJson(ajustes: Partial<Record<Vista, AjusteFoto>>): string {
  const usados = Object.fromEntries(
    Object.entries(ajustes).filter(([, a]) => a && (a.rotacao_graus % 360 !== 0 || a.recorte !== null)),
  )
  return JSON.stringify(usados, null, 2)
}
