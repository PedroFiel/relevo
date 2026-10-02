/** Modelos que acompanham o front (public/samples). O tenis-01 é gerado por `make real`. */
export type Amostra = { id: string; rotulo: string; url: string }

export const AMOSTRAS: Amostra[] = [
  { id: 'tenis-01', rotulo: 'Tênis 01 (fotos reais)', url: '/samples/tenis-01.glb' },
  { id: 'exemplo', rotulo: 'Exemplo sintético', url: '/samples/tenis-exemplo.glb' },
]

/** Aceita só .glb/.gltf — o visualizador não abre outros formatos. */
export function arquivoValido(nome: string): boolean {
  return /\.(glb|gltf)$/i.test(nome)
}
