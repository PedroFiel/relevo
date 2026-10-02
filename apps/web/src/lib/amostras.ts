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

/** Aceita só .glb/.gltf — o visualizador não abre outros formatos. */
export function arquivoValido(nome: string): boolean {
  return /\.(glb|gltf)$/i.test(nome)
}
