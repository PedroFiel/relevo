/**
 * Plano de corte (F2-T11). Um plano é { normal n, constante d }: os pontos com n·p + d ≥ 0 ficam
 * VISÍVEIS (semiespaço) e os outros são descartados pela GPU — é a mesma convenção do three.js
 * (`material.clippingPlanes`): "distância com sinal negativa = recortado".
 */
export type Eixo = 'x' | 'y' | 'z'
export type Vec3 = [number, number, number]
export type Plano = { normal: Vec3; constante: number }

const UNITARIO: Record<Eixo, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/**
 * Plano perpendicular ao eixo, passando por `posicao` (cm). Sem inverter, fica o lado
 * `eixo ≤ posicao` (n = −e, d = posicao); invertido, fica `eixo ≥ posicao` (n = e, d = −posicao).
 */
export function planoDeCorte(eixo: Eixo, posicao: number, inverter = false): Plano {
  const e = UNITARIO[eixo]
  return inverter
    ? { normal: e, constante: -posicao }
    : { normal: [-e[0], -e[1], -e[2]] as Vec3, constante: posicao }
}

/** Distância com sinal do ponto ao plano: ≥ 0 visível, < 0 recortado. */
export function ladoDoPlano(p: Vec3, plano: Plano): number {
  const [nx, ny, nz] = plano.normal
  return nx * p[0] + ny * p[1] + nz * p[2] + plano.constante
}

/** Um ponto sobre o plano (para posicionar a "tampa" do corte): −d · n. */
export function pontoNoPlano(plano: Plano): Vec3 {
  const [nx, ny, nz] = plano.normal
  return [-plano.constante * nx, -plano.constante * ny, -plano.constante * nz]
}

export const EIXOS: { id: Eixo; rotulo: string }[] = [
  { id: 'x', rotulo: 'Comprimento (x)' },
  { id: 'y', rotulo: 'Altura (y)' },
  { id: 'z', rotulo: 'Largura (z)' },
]
