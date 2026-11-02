/** Tipos e estado inicial compartilhados entre a página do visualizador e o ModelViewer. */
import type { PresetCamera } from './camera'
import type { Eixo, Vec3 } from './corte'

export type Corte = { ativo: boolean; eixo: Eixo; posicao: number; inverter: boolean; tampa: boolean }
export type Zoom = { noPonto: boolean }
export type Transformacao = { posicao: Vec3; rotacao: Vec3; escala: number }
export type Cursor = { modelo: Vec3; normal: Vec3 } | null
export type Caixa = { min: Vec3; max: Vec3 }

export type Iluminacao = {
  azimute: number
  elevacao: number
  ambiente: number
  direcional: number
  sombraChao: boolean
}

export const ILUMINACAO_INICIAL: Iluminacao = {
  azimute: -35,
  elevacao: 55,
  ambiente: 1.2,
  direcional: 2.0,
  sombraChao: true,
}

export type AuxiliaresCena = {
  grade: boolean
  eixos: boolean
  caixa: boolean
  ortografica: boolean
  lodAutomatico: boolean
}

export const AUXILIARES_INICIAIS: AuxiliaresCena = {
  grade: true,
  eixos: false,
  caixa: false,
  ortografica: false,
  lodAutomatico: false,
}

export type EstatisticasMalha = {
  vertices: number
  triangulos: number
  dimensoesCm: Vec3
}

export const TRANSFORMACAO_INICIAL: Transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: 1 }

/** Pedidos de ação vindos do painel (o `id` muda a cada clique para disparar de novo). */
export type Comando =
  | { id: number; tipo: 'ampliar'; fator: number }
  | { id: number; tipo: 'enquadrar' }
  | { id: number; tipo: 'preset'; preset: PresetCamera }
  | { id: number; tipo: 'raios' }
  /** retângulo em coordenadas normalizadas da tela (NDC: −1..1, y para cima) */
  | { id: number; tipo: 'separar'; retangulo: { x0: number; y0: number; x1: number; y1: number } }
  | { id: number; tipo: 'juntar' }

export type InfoSeparacao = { triangulosParte: number; triangulosResto: number; cortados: number; ms: number }

/**
 * Leitura da câmera para o painel. `frente`/`fundo`: distância (cm), ao longo do eixo de visão, do
 * ponto mais próximo/mais distante da esfera que envolve o modelo — é onde o plano near começa e
 * termina de cortar o tênis.
 */
export type InfoCamera = { distancia: number; fov: number; near: number; frente: number; fundo: number }

/** O near nunca chega a 0: a matriz de perspectiva divide por ele (e o z-buffer perde precisão). */
export const NEAR_MINIMO = 0.1

/**
 * Plano near a partir de "quanto do tênis cortar" (cm a partir da frente do modelo).
 * Profundidade 0 = nada cortado (near no mínimo); profundidade = fundo − frente = tudo cortado.
 */
export function nearDaProfundidade(profundidade: number, frente: number): number {
  if (profundidade <= 0) return NEAR_MINIMO
  return Math.max(NEAR_MINIMO, frente + profundidade)
}

/** Estatísticas geométricas da malha (F2-T07). */
export function calcularEstatisticas(vertices: number, triangulos: number, caixa: Caixa): EstatisticasMalha {
  const dimensoesCm: Vec3 = [
    Math.round((caixa.max[0] - caixa.min[0]) * 100) / 100,
    Math.round((caixa.max[1] - caixa.min[1]) * 100) / 100,
    Math.round((caixa.max[2] - caixa.min[2]) * 100) / 100,
  ]
  return { vertices, triangulos, dimensoesCm }
}

/** Distância euclidiana em centímetros entre dois pontos 3D na superfície do modelo (F5-T03). */
export function distanciaCm(p1: Vec3, p2: Vec3, escala = 1): number {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const dz = p2[2] - p1[2]
  return Math.round(Math.hypot(dx, dy, dz) * escala * 100) / 100
}

/**
 * Seleciona o nível de detalhe (LOD 0 = 100 %, LOD 1 = 25 %, LOD 2 = 5 %, F5-T02)
 * em função da distância da câmera ao modelo (em cm).
 */
export function nivelLodPorDistancia(
  distanciaCameraCm: number,
  triangulosBase: number,
): { nivel: 0 | 1 | 2; fracao: number; rotulo: string; triangulos: number } {
  if (distanciaCameraCm > 85) {
    return {
      nivel: 2,
      fracao: 0.05,
      rotulo: 'LOD 2 (5 %)',
      triangulos: Math.max(24, Math.round(triangulosBase * 0.05)),
    }
  }
  if (distanciaCameraCm > 50) {
    return {
      nivel: 1,
      fracao: 0.25,
      rotulo: 'LOD 1 (25 %)',
      triangulos: Math.max(24, Math.round(triangulosBase * 0.25)),
    }
  }
  return {
    nivel: 0,
    fracao: 1.0,
    rotulo: 'LOD 0 (100 %)',
    triangulos: triangulosBase,
  }
}

/** Tudo que o rastreamento de raios precisa, já no espaço do MUNDO. */
export type DadosRaios = {
  pos: Float32Array
  idx: Uint32Array
  cores: Float32Array | null
  invViewProj: number[]
  camera: Vec3
  luz: Vec3
  largura: number
  altura: number
  plano: { normal: Vec3; constante: number } | null
  /** A mesma vista, desenhada pela GPU (rasterização), para comparar lado a lado. */
  imagemRaster?: string
}
