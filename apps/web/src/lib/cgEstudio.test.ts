import { describe, expect, it } from 'vitest'
import { limparToken, obterToken, salvarToken } from './api'
import { DIRECOES_PRESET, distanciaParaEnquadrar, esfericaParaCartesiana } from './camera'
import { aplicar4, compor, comporComPivo } from './matrizes'
import { calcularEstatisticas, distanciaCm, nivelLodPorDistancia } from './visualizador'

describe('Matemática do estúdio 3D (F2-T02, F2-T04, F2-T07, F4-T03b, F5-T02, F5-T03)', () => {
  it('distanciaParaEnquadrar cresce quando o raio aumenta ou o FOV diminui (F2-T02)', () => {
    const d1 = distanciaParaEnquadrar(10, 40)
    const d2 = distanciaParaEnquadrar(20, 40)
    const dFovMenor = distanciaParaEnquadrar(10, 25)
    expect(d2).toBeCloseTo(d1 * 2, 5)
    expect(dFovMenor).toBeGreaterThan(d1)
    expect(Object.keys(DIRECOES_PRESET)).toEqual(['perspectiva', 'lateral', 'topo', 'frente'])
  })

  it('esfericaParaCartesiana preserva o raio e coloca elevação 90° no eixo +Y (F2-T04)', () => {
    const topo = esfericaParaCartesiana(0, 90, 30)
    expect(topo[0]).toBeCloseTo(0, 1)
    expect(topo[1]).toBeCloseTo(30, 1)
    expect(topo[2]).toBeCloseTo(0, 1)

    const inclinada = esfericaParaCartesiana(45, 30, 40)
    const norma = Math.hypot(...inclinada)
    expect(norma).toBeCloseTo(40, 1)
  })

  it('comporComPivo coincide com compor na origem e mantém o pivô fixo numa rotação pura (F4-T03b)', () => {
    const mOrig = compor([2, -1, 4], [15, 30, -20], [1.2, 1.2, 1.2], 'TRS')
    const mPivoZero = comporComPivo([2, -1, 4], [15, 30, -20], [1.2, 1.2, 1.2], [0, 0, 0], 'TRS')
    expect(mPivoZero).toEqual(mOrig)

    const pivo: [number, number, number] = [5, 3, -2]
    const mRotPivo = comporComPivo([0, 0, 0], [40, -65, 25], [1, 1, 1], pivo, 'TRS')
    const pivoTransformado = aplicar4(mRotPivo, pivo)
    expect(pivoTransformado[0]).toBeCloseTo(pivo[0], 5)
    expect(pivoTransformado[1]).toBeCloseTo(pivo[1], 5)
    expect(pivoTransformado[2]).toBeCloseTo(pivo[2], 5)
  })

  it('calcularEstatisticas, distanciaCm e nivelLodPorDistancia (F2-T07, F5-T02, F5-T03)', () => {
    const stats = calcularEstatisticas(1002, 2000, { min: [-14, 0, -5], max: [14, 10.5, 5] })
    expect(stats).toEqual({
      vertices: 1002,
      triangulos: 2000,
      dimensoesCm: [28, 10.5, 10],
    })

    // Triângulo 3-4-5 em cm com escala 1 e escala 2
    expect(distanciaCm([0, 0, 0], [3, 4, 0], 1)).toBe(5)
    expect(distanciaCm([0, 0, 0], [3, 4, 0], 2)).toBe(10)

    const lod0 = nivelLodPorDistancia(30, 20000)
    const lod1 = nivelLodPorDistancia(65, 20000)
    const lod2 = nivelLodPorDistancia(100, 20000)
    expect(lod0.nivel).toBe(0)
    expect(lod1.nivel).toBe(1)
    expect(lod2.nivel).toBe(2)
    expect(lod0.triangulos).toBeGreaterThan(lod1.triangulos)
    expect(lod1.triangulos).toBeGreaterThan(lod2.triangulos)
  })

  it('salvarToken, obterToken e limparToken funcionam no localStorage (F4-T01)', () => {
    limparToken()
    expect(obterToken()).toBeNull()
    salvarToken('jwt-teste-123')
    expect(obterToken()).toBe('jwt-teste-123')
    limparToken()
    expect(obterToken()).toBeNull()
  })
})
