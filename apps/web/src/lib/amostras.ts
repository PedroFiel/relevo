/**
 * Modelos que acompanham o front (public/samples). Os tenis-0N são gerados por `make reais`, que
 * também publica `public/samples/<id>/` com as fotos e o metricas.json (página /fotos).
 */
export type Amostra = { id: string; rotulo: string; url: string }

/** Pasta publicada pelo pipeline (fotos/ + metricas.json); só para os tênis reais. */
export function pastaDaAmostra(id: string): string {
  return `/samples/${id}`
}

export const AMOSTRAS: Amostra[] = [
  { id: 'tenis-01', rotulo: 'Tênis 01 (fotos reais)', url: '/samples/tenis-01.glb' },
  { id: 'tenis-02', rotulo: 'Tênis 02 (fotos reais)', url: '/samples/tenis-02.glb' },
  { id: 'tenis-03', rotulo: 'Tênis 03 (5 vistas)', url: '/samples/tenis-03.glb' },
  { id: 'exemplo', rotulo: 'Exemplo sintético', url: '/samples/tenis-exemplo.glb' },
]

export type Formato3D = 'glb' | 'gltf' | 'obj' | 'stl'

/** Aceita os formatos 3D suportados pelo RELEVO: .glb, .gltf, .obj e .stl. */
export function arquivoValido(nome: string): boolean {
  return /\.(glb|gltf|obj|stl)$/i.test(nome)
}

/** Detecta o formato a partir da extensão ou do parâmetro explícito. */
export function inferirFormato(url: string, formato?: Formato3D): 'glb' | 'obj' | 'stl' {
  if (formato) {
    const f = formato.toLowerCase().trim()
    if (f === 'obj') return 'obj'
    if (f === 'stl') return 'stl'
    return 'glb'
  }
  const limpa = url.toLowerCase()
  if (limpa.includes('.obj') || limpa.includes('formato=obj')) return 'obj'
  if (limpa.includes('.stl') || limpa.includes('formato=stl')) return 'stl'
  return 'glb'
}
