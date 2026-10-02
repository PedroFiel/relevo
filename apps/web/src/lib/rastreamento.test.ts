import { describe, expect, it } from 'vitest'
import { construirBVH, corDoRaio, intersectar, paraSRGB, raioDoPixel, raioTriangulo, type V3 } from './rastreamento'

/** Esfera triangulada (UV) — malha fechada de teste. */
function esfera(raio: number, centro: V3, n = 16) {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n
    for (let j = 0; j <= n; j++) {
      const ph = (2 * Math.PI * j) / n
      pos.push(centro[0] + raio * Math.sin(th) * Math.cos(ph), centro[1] + raio * Math.cos(th), centro[2] + raio * Math.sin(th) * Math.sin(ph))
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j
      idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2)
    }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) }
}

function forcaBruta(pos: Float32Array, idx: Uint32Array, o: V3, d: V3) {
  let melhor = Infinity
  for (let t = 0; t < idx.length / 3; t++) {
    const P = (k: number): V3 => [pos[3 * idx[3 * t + k]], pos[3 * idx[3 * t + k] + 1], pos[3 * idx[3 * t + k] + 2]]
    const r = raioTriangulo(o, d, P(0), P(1), P(2))
    if (r && r.t < melhor) melhor = r.t
  }
  return melhor
}

describe('Möller–Trumbore', () => {
  const A: V3 = [0, 0, 0], B: V3 = [1, 0, 0], C: V3 = [0, 1, 0]
  it('acerta no meio com t e baricêntricas certos', () => {
    const r = raioTriangulo([0.25, 0.25, 5], [0, 0, -1], A, B, C)!
    expect(r.t).toBeCloseTo(5)
    expect(r.u).toBeCloseTo(0.25)
    expect(r.v).toBeCloseTo(0.25)
  })
  it('erra fora do triângulo, paralelo e atrás', () => {
    expect(raioTriangulo([0.8, 0.8, 5], [0, 0, -1], A, B, C)).toBeNull()
    expect(raioTriangulo([0.2, 0.2, 5], [1, 0, 0], A, B, C)).toBeNull()
    expect(raioTriangulo([0.2, 0.2, 5], [0, 0, 1], A, B, C)).toBeNull()
  })
})

describe('BVH', () => {
  const { pos, idx } = esfera(3, [0, 4, 0], 24)
  const bvh = construirBVH(pos, idx)

  it('dá o mesmo resultado que testar todos os triângulos', () => {
    let rng = 7
    const aleatorio = () => ((rng = (rng * 16807) % 2147483647) / 2147483647) * 2 - 1
    for (let k = 0; k < 200; k++) {
      const o: V3 = [aleatorio() * 10, 4 + aleatorio() * 10, 10 + aleatorio()]
      const alvo: V3 = [aleatorio() * 3, 4 + aleatorio() * 3, aleatorio() * 3]
      const d0: V3 = [alvo[0] - o[0], alvo[1] - o[1], alvo[2] - o[2]]
      const n = Math.hypot(...d0)
      const d: V3 = [d0[0] / n, d0[1] / n, d0[2] / n]
      const bf = forcaBruta(pos, idx, o, d)
      const h = intersectar(bvh, o, d)
      if (bf === Infinity) expect(h).toBeNull()
      else expect(h!.t).toBeCloseTo(bf, 4)
    }
  })

  it('acerta a esfera na distância esperada', () => {
    const h = intersectar(bvh, [0, 4, 20], [0, 0, -1])!
    expect(h.t).toBeGreaterThan(16.9)
    expect(h.t).toBeLessThan(17.05) // 20 − 3 (a malha fica um pouco por dentro da esfera)
  })

  it('filtro de pontos (plano de corte) faz o raio atravessar a parte cortada', () => {
    const h = intersectar(bvh, [0, 4, 20], [0, 0, -1], Infinity, false, (p) => p[2] < 0)!
    expect(h.t).toBeGreaterThan(22.9) // saiu pela parede de trás (z ≈ −3)
  })
})

describe('sombreamento', () => {
  const { pos, idx } = esfera(3, [0, 4, 0], 24)
  const cena = { bvh: construirBVH(pos, idx), cores: null, luz: [0, 1, 0] as V3 }

  it('o chão logo abaixo da esfera está na sombra; longe dela, não', () => {
    const sob = corDoRaio(cena, [0.1, 20, 0.1], [0, -1, 0].map((v) => v) as V3) // bate no topo da esfera
    expect(sob[0]).toBeGreaterThan(0) // é o modelo
    const chaoSombra = corDoRaio(cena, [0, 0.5, 20], [0, -0.0249, -0.9997] as V3)
    const chaoLuz = corDoRaio(cena, [15, 0.5, 20], [0, -0.0249, -0.9997] as V3)
    expect(chaoSombra[0]).toBeLessThan(chaoLuz[0])
  })

  it('raio do pixel central aponta para o centro da imagem e sRGB', () => {
    // matriz identidade: o "mundo" é o próprio NDC; câmera na origem
    const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const d = raioDoPixel(id, [0, 0, -1], 49.5, 49.5, 100, 100)
    expect(d[0]).toBeCloseTo(0, 2)
    expect(d[1]).toBeCloseTo(0, 2)
    expect(paraSRGB(1)).toBe(255)
    expect(paraSRGB(0.2158)).toBe(128) // cinza médio
  })
})
