/** Tipos e estado inicial compartilhados entre a página do visualizador e o ModelViewer. */
import type { Eixo, Vec3 } from './corte'

export type Corte = { ativo: boolean; eixo: Eixo; posicao: number; inverter: boolean; tampa: boolean }
export type Zoom = { noPonto: boolean }
export type Transformacao = { posicao: Vec3; rotacao: Vec3; escala: number }
export type Cursor = { modelo: Vec3; normal: Vec3 } | null
export type Caixa = { min: Vec3; max: Vec3 }

export const TRANSFORMACAO_INICIAL: Transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: 1 }

/** Pedidos de ação vindos do painel (o `id` muda a cada clique para disparar de novo). */
export type Comando =
  | { id: number; tipo: 'ampliar'; fator: number }
  | { id: number; tipo: 'enquadrar' }
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
