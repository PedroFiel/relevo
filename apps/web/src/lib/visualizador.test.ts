import { describe, expect, it } from 'vitest'
import { NEAR_MINIMO, nearDaProfundidade, simplificarMalhaLod } from './visualizador'

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

describe('simplificarMalhaLod (Vertex Clustering para LOD 1 e LOD 2 — F5-T02)', () => {
  it('reduz progressivamente o número de triângulos em LOD 1 e LOD 2 preservando cores', () => {
    // Gera uma grade densa de triângulos 40x20 (1600 triângulos)
    const nx = 40
    const ny = 20
    const pos: number[] = []
    const cores: number[] = []
    const idx: number[] = []
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        pos.push((i / nx) * 28, (j / ny) * 10, Math.sin(i * 0.2) * 2)
        cores.push(i / nx, j / ny, 0.5)
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i
        const b = a + 1
        const c = a + (nx + 1)
        const d = c + 1
        idx.push(a, b, c, b, d, c)
      }
    }
    const posArr = new Float32Array(pos)
    const idxArr = new Uint32Array(idx)
    const corArr = new Float32Array(cores)

    const lod0 = simplificarMalhaLod(posArr, idxArr, corArr, 3, 0)
    const lod1 = simplificarMalhaLod(posArr, idxArr, corArr, 3, 1)
    const lod2 = simplificarMalhaLod(posArr, idxArr, corArr, 3, 2)

    expect(lod0.indices.length / 3).toBe(1600)
    expect(lod1.indices.length / 3).toBeLessThan(lod0.indices.length / 3)
    expect(lod2.indices.length / 3).toBeLessThan(lod1.indices.length / 3)
    expect(lod2.cores).not.toBeNull()
    expect(lod2.cores?.length).toBe(lod2.posicoes.length)
  })
})
