import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { distancia, fatorDaRoda, pontoDeZoom, zoomLente } from './camera'
import { ladoDoPlano, planoDeCorte, pontoNoPlano, type Vec3 } from './corte'
import { aplicar4, compor, linhasDaMatriz, paraColunas } from './matrizes'

const perto = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6))

describe('plano de corte (F2-T11)', () => {
  it('sem inverter mantém o lado eixo ≤ posição; invertido, o lado ≥', () => {
    const p = planoDeCorte('x', 5)
    expect(ladoDoPlano([4, 0, 0], p)).toBeGreaterThan(0)
    expect(ladoDoPlano([6, 0, 0], p)).toBeLessThan(0)
    const inv = planoDeCorte('x', 5, true)
    expect(ladoDoPlano([6, 0, 0], inv)).toBeGreaterThan(0)
    expect(ladoDoPlano([4, 0, 0], inv)).toBeLessThan(0)
  })

  it.each(['x', 'y', 'z'] as const)('ponto no plano tem distância zero (eixo %s)', (eixo) => {
    for (const inverter of [false, true]) {
      const p = planoDeCorte(eixo, 3.5, inverter)
      expect(ladoDoPlano(pontoNoPlano(p), p)).toBeCloseTo(0)
    }
  })

  it('é a mesma convenção do three.js (distância negativa = recortado)', () => {
    const p = planoDeCorte('y', 2)
    const t = new THREE.Plane(new THREE.Vector3(...p.normal), p.constante)
    expect(t.distanceToPoint(new THREE.Vector3(0, 7, 0))).toBeCloseTo(ladoDoPlano([0, 7, 0], p))
  })
})

describe('zoom 3D (F2-T12)', () => {
  const camera: Vec3 = [30, 20, 30]
  const alvo: Vec3 = [0, 4, 0]
  const ponto: Vec3 = [10, 5, 2]

  it('dolly no ponto: câmera fica na reta câmera → ponto e o ponto não sai do lugar na tela', () => {
    const r = pontoDeZoom(camera, alvo, ponto, 0.5)
    expect(distancia(r.camera, ponto)).toBeCloseTo(distancia(camera, ponto) / 2)
    // mesma direção câmera→ponto antes e depois (o ponto fica no mesmo pixel)
    const dir = (c: Vec3) => {
      const d = distancia(c, ponto)
      return [(ponto[0] - c[0]) / d, (ponto[1] - c[1]) / d, (ponto[2] - c[2]) / d]
    }
    perto(dir(r.camera), dir(camera))
  })

  it('fator 1 não move e há distância mínima', () => {
    expect(pontoDeZoom(camera, alvo, ponto, 1)).toEqual({ camera, alvo })
    expect(distancia(pontoDeZoom(camera, alvo, ponto, 0.0001, 3).camera, ponto)).toBeCloseTo(3)
  })

  it('lente limitada e roda do mouse', () => {
    expect(zoomLente(40, 0.1)).toBe(8)
    expect(zoomLente(40, 10)).toBe(75)
    expect(fatorDaRoda(100)).toBeGreaterThan(1)
    expect(fatorDaRoda(-100)).toBeLessThan(1)
  })
})

describe('matrizes 4×4 (F2-T13)', () => {
  it('compor TRS é igual ao Matrix4.compose do three.js', () => {
    const pos: Vec3 = [3, -2, 5]
    const rot: Vec3 = [30, -45, 60]
    const esc: Vec3 = [1.1, 1.1, 1.1]
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...(rot.map((g) => (g * Math.PI) / 180) as Vec3), 'XYZ'),
    )
    const ref = new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...esc))
    perto(paraColunas(compor(pos, rot, esc)), ref.elements)
  })

  it('a ordem importa: T·R·S ≠ S·R·T', () => {
    const trs = compor([10, 0, 0], [0, 90, 0], [2, 2, 2], 'TRS')
    const srt = compor([10, 0, 0], [0, 90, 0], [2, 2, 2], 'SRT')
    perto(aplicar4(trs, [0, 0, 0]), [10, 0, 0])
    perto(aplicar4(srt, [0, 0, 0]), [0, 0, -20]) // a translação também foi girada e escalada
  })

  it('aumentar 10 % um tênis de 30 cm dá 33 cm', () => {
    const m = compor([0, 0, 0], [0, 0, 0], [1.1, 1.1, 1.1])
    expect(aplicar4(m, [15, 0, 0])[0] - aplicar4(m, [-15, 0, 0])[0]).toBeCloseTo(33)
  })

  it('formata 4 linhas', () => {
    expect(linhasDaMatriz(compor([1, 2, 3], [0, 0, 0], [1, 1, 1]))[0].trim()).toBe('1.00    0.00    0.00    1.00')
  })
})
