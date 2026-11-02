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

/**
 * Distância da câmera ao centro da esfera envolvente para enquadrar o objeto inteiro (F2-T02):
 * d = (raio / sen(fov/2)) · margem.
 */
export function distanciaParaEnquadrar(raio: number, fovGraus: number, margem = 1.15): number {
  const meioFovRad = ((Math.max(10, Math.min(120, fovGraus)) / 2) * Math.PI) / 180
  return (Math.max(0.1, raio) / Math.sin(meioFovRad)) * margem
}

export type PresetCamera = 'perspectiva' | 'lateral' | 'topo' | 'frente'

/** Direções unitárias de cada vista predefinida de câmera (F2-T02). */
export const DIRECOES_PRESET: Record<PresetCamera, Vec3> = {
  perspectiva: [0.62, 0.42, 0.66],
  lateral: [0, 0.08, 1],
  topo: [0, 1, 0.02],
  frente: [1, 0.08, 0],
}

/**
 * Converte coordenadas esféricas (azimute e elevação em graus, raio) para cartesianas (x, y, z)
 * para posicionar a luz direcional (F2-T04).
 */
export function esfericaParaCartesiana(azimuteGraus: number, elevacaoGraus: number, raio = 36): Vec3 {
  const az = (azimuteGraus * Math.PI) / 180
  const el = (elevacaoGraus * Math.PI) / 180
  const cosEl = Math.cos(el)
  return [
    Math.round(raio * cosEl * Math.sin(az) * 100) / 100,
    Math.round(raio * Math.sin(el) * 100) / 100,
    Math.round(raio * cosEl * Math.cos(az) * 100) / 100,
  ]
}
