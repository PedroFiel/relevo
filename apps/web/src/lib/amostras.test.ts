import { describe, expect, it } from 'vitest'
import { AMOSTRAS, arquivoValido } from './amostras'

describe('amostras', () => {
  it('tem ids únicos e urls dentro de /samples', () => {
    expect(new Set(AMOSTRAS.map((a) => a.id)).size).toBe(AMOSTRAS.length)
    expect(AMOSTRAS.every((a) => a.url.startsWith('/samples/'))).toBe(true)
  })

  it('aceita glb/gltf (qualquer caixa) e recusa o resto', () => {
    expect(arquivoValido('tenis.glb')).toBe(true)
    expect(arquivoValido('TENIS.GLTF')).toBe(true)
    expect(arquivoValido('tenis.obj')).toBe(false)
    expect(arquivoValido('foto.jpg')).toBe(false)
  })
})
