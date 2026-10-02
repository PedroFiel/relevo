import { describe, expect, it } from 'vitest'
import { area, dividirPoligono, planoPor, planosDaSelecao, separar, type V3 } from './selecao'

/** Grade plana z = 0 de n × n quadrados (2 triângulos cada), lado total 10, centrada na origem. */
function grade(n = 10) {
  const pos: number[] = []
  const idx: number[] = []
  const cor: number[] = []
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      pos.push(-5 + (10 * i) / n, -5 + (10 * j) / n, 0)
      cor.push(i / n, j / n, 0.5)
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1)
    }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), cor: new Float32Array(cor) }
}

// Seleção "vista de frente" com a câmera longe em +z: um retângulo x ∈ [−2, 3], y ∈ [−1, 4]
const camera: V3 = [0, 0, 1000]
const cantos: [V3, V3, V3, V3] = [[-2, -1, 0], [3, -1, 0], [3, 4, 0], [-2, 4, 0]]
const planos = planosDaSelecao(camera, cantos, [0.5, 1.5, 0])

describe('volume de seleção', () => {
  it('os 4 planos têm o centro do lado de dentro', () => {
    for (const p of planos) expect(p.n[0] * 0.5 + p.n[1] * 1.5 + p.d).toBeGreaterThan(0)
  })

  it('plano orientado pelo ponto de dentro', () => {
    const p = planoPor([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1])
    expect(p.n[2]).toBeCloseTo(-1)
  })
})

describe('Sutherland–Hodgman contra um plano', () => {
  it('triângulo cortado ao meio: os dois lados somam a área original', () => {
    const tri = [
      { p: [0, 0, 0] as V3, c: [0, 0, 0] as V3 },
      { p: [4, 0, 0] as V3, c: [1, 0, 0] as V3 },
      { p: [0, 4, 0] as V3, c: [0, 1, 0] as V3 },
    ]
    const { dentro, fora } = dividirPoligono(tri, { n: [-1, 0, 0], d: 2 }) // dentro: x <= 2
    expect(dentro.every((v) => v.p[0] <= 2 + 1e-9)).toBe(true)
    expect(fora.every((v) => v.p[0] >= 2 - 1e-9)).toBe(true)
    // vértice novo em x = 2 na aresta (0,0)-(4,0) com cor interpolada pela metade
    const novo = dentro.find((v) => Math.abs(v.p[0] - 2) < 1e-9 && Math.abs(v.p[1]) < 1e-9)!
    expect(novo.c[0]).toBeCloseTo(0.5)
  })
})

describe('separar', () => {
  const { pos, idx, cor } = grade()
  const s = separar(pos, idx, cor, planos)

  it('não cria nem perde área: parte + resto = original', () => {
    expect(area(s.parte) + area(s.resto)).toBeCloseTo(100, 4)
  })

  it('a parte é exatamente o retângulo selecionado (5 × 5 = 25)', () => {
    expect(area(s.parte)).toBeCloseTo(25, 3)
    for (let i = 0; i < s.parte.pos.length; i += 3) {
      expect(s.parte.pos[i]).toBeGreaterThanOrEqual(-2 - 1e-4)
      expect(s.parte.pos[i]).toBeLessThanOrEqual(3 + 1e-4)
    }
  })

  it('triângulos da borda foram recortados e a cor acompanha', () => {
    expect(s.cortados).toBeGreaterThan(0)
    expect(s.parte.cor).not.toBeNull()
    expect(s.parte.cor!.length).toBe(s.parte.pos.length)
  })

  it('seleção fora da malha não pega nada', () => {
    const longe = planosDaSelecao(camera, [[20, 20, 0], [25, 20, 0], [25, 25, 0], [20, 25, 0]], [22, 22, 0])
    const r = separar(pos, idx, cor, longe)
    expect(r.parte.triangulos).toBe(0)
    expect(area(r.resto)).toBeCloseTo(100, 4)
  })
})
