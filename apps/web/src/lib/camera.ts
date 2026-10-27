/**
 * Zoom 3D (F2-T12): **aproximar (dolly)** — a câmera ANDA em direção ao ponto. Muda a perspectiva
 * (o que está perto cresce mais). O zoom de lente (FOV) foi tirado em 27/10/2026: no uso, não dava
 * para perceber a diferença.
 */
import type { Vec3 } from './corte'

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const soma = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mult = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const distancia = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b))

/**
 * Dolly em direção a um ponto do modelo (achado por raycasting): câmera e alvo da órbita sofrem a
 * mesma homotetia de centro `ponto` e razão `fator` — c' = p + (c − p)·fator. Assim o ponto sob o
 * cursor continua no mesmo lugar da tela. `fator` < 1 aproxima. Nunca chega mais perto que
 * `distanciaMinima` do ponto.
 */
export function pontoDeZoom(
  camera: Vec3,
  alvo: Vec3,
  ponto: Vec3,
  fator: number,
  distanciaMinima = 2,
): { camera: Vec3; alvo: Vec3 } {
  const d = distancia(camera, ponto)
  const f = d * fator < distanciaMinima ? distanciaMinima / d : fator
  return { camera: soma(ponto, mult(sub(camera, ponto), f)), alvo: soma(ponto, mult(sub(alvo, ponto), f)) }
}

/** Fator por "clique" da roda do mouse (deltaY > 0 afasta). */
export function fatorDaRoda(deltaY: number): number {
  return Math.exp(Math.sign(deltaY) * Math.min(Math.abs(deltaY), 120) * 0.0015)
}
