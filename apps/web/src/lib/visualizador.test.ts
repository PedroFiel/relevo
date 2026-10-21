import { describe, expect, it } from 'vitest'
import { NEAR_MINIMO, nearDaProfundidade } from './visualizador'

describe('nearDaProfundidade (recorte pelo plano near)', () => {
  it('profundidade 0 não corta nada: near fica no mínimo', () => {
    expect(nearDaProfundidade(0, 35)).toBe(NEAR_MINIMO)
  })

  it('o near começa na frente do modelo e anda a profundidade pedida', () => {
    expect(nearDaProfundidade(5, 35)).toBe(40)
  })

  it('câmera dentro da esfera do modelo (frente negativa) não deixa o near abaixo do mínimo', () => {
    expect(nearDaProfundidade(2, -10)).toBe(NEAR_MINIMO)
    expect(nearDaProfundidade(12, -10)).toBe(2)
  })
})
