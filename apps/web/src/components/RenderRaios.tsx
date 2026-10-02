import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  LUZ_AMBIENTE,
  construirBVH,
  explicarRaio,
  paraSRGB,
  raioDoPixel,
  type BVH,
  type Cena,
  type Explicacao,
  type V3,
} from '../lib/rastreamento'
import type { DadosRaios } from '../lib/visualizador'

type Velocidade = 'rapido' | 'passo'
type Estado = { linhas: number; ms: number }

// Rápido: meia resolução, ~24 ms de trabalho por quadro. Passo a passo: 1/3 da resolução e uma
// linha por quadro — dá para VER a varredura de cima para baixo.
const CONFIG: Record<Velocidade, { escala: number; linhasPorQuadro: number }> = {
  rapido: { escala: 0.5, linhasPorQuadro: Infinity },
  passo: { escala: 1 / 3, linhasPorQuadro: 1 },
}
const ORCAMENTO_MS = 24

const fmt = (v: number, c = 1) => v.toFixed(c)
const vec = (v: V3 | null, c = 1) => (v ? `(${v.map((x) => fmt(x, c)).join('; ')})` : '—')

function montarCena(dados: DadosRaios): { cena: Cena; msBVH: number } {
  const t0 = performance.now()
  const bvh: BVH = construirBVH(dados.pos, dados.idx)
  const { plano } = dados
  const cena: Cena = {
    bvh,
    cores: dados.cores,
    luz: dados.luz,
    aceita: plano
      ? (p: V3) => plano.normal[0] * p[0] + plano.normal[1] * p[1] + plano.normal[2] * p[2] + plano.constante >= 0
      : undefined,
  }
  return { cena, msBVH: performance.now() - t0 }
}

/**
 * Rastreamento de raios explicado: à esquerda a imagem da GPU (rasterização), à direita a nossa
 * (um raio por pixel + raio de sombra), lado a lado e da MESMA câmera. Clicar num pixel da direita
 * mostra o caminho daquele raio.
 */
export default function RenderRaios({ dados, aoFechar }: { dados: DadosRaios; aoFechar: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [velocidade, setVelocidade] = useState<Velocidade>('rapido')
  const [estado, setEstado] = useState<Estado>({ linhas: 0, ms: 0 })
  const [pixel, setPixel] = useState<{ x: number; y: number; e: Explicacao } | null>(null)
  const { escala, linhasPorQuadro } = CONFIG[velocidade]
  const W = Math.max(1, Math.round(dados.largura * escala))
  const H = Math.max(1, Math.round(dados.altura * escala))

  // A BVH é montada uma vez por cena (é a parte cara: ~0,3 s para 200 mil triângulos)
  const { cena, msBVH } = useMemo(() => montarCena(dados), [dados])

  useEffect(() => {
    let cancelado = false
    let quadro = 0
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(W, H)
    let y = 0
    const t1 = performance.now()
    const passo = () => {
      if (cancelado) return
      const limite = performance.now() + ORCAMENTO_MS
      let feitas = 0
      while (y < H && feitas < linhasPorQuadro && performance.now() < limite) {
        for (let x = 0; x < W; x++) {
          const d = raioDoPixel(dados.invViewProj, dados.camera, x, y, W, H)
          const c = explicarRaio(cena, dados.camera, d).cor
          const k = 4 * (y * W + x)
          img.data[k] = paraSRGB(c[0])
          img.data[k + 1] = paraSRGB(c[1])
          img.data[k + 2] = paraSRGB(c[2])
          img.data[k + 3] = 255
        }
        y++
        feitas++
      }
      ctx.putImageData(img, 0, 0)
      // linha "de varredura" em destaque no modo passo a passo
      if (y < H && linhasPorQuadro === 1) {
        ctx.fillStyle = '#ffd166'
        ctx.fillRect(0, y, W, 1)
      }
      setEstado({ linhas: y, ms: performance.now() - t1 })
      if (y < H) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => {
      cancelado = true
      cancelAnimationFrame(quadro)
    }
  }, [dados, cena, W, H, linhasPorQuadro])

  function aoClicar(e: MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    // o canvas é exibido esticado (object-fit: contain): converte para pixel da imagem
    const k = Math.min(r.width / W, r.height / H)
    const x = Math.floor((e.clientX - r.left - (r.width - W * k) / 2) / k)
    const y = Math.floor((e.clientY - r.top - (r.height - H * k) / 2) / k)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const d = raioDoPixel(dados.invViewProj, dados.camera, x, y, W, H)
    setPixel({ x, y, e: explicarRaio(cena, dados.camera, d) })
  }

  const triangulos = dados.idx.length / 3
  const pronto = estado.linhas >= H
  const p = pixel?.e
  return (
    <div className="raios" role="dialog" aria-label="Rastreamento de raios">
      <div className="raios-topo">
        <strong>Rasterização × rastreamento de raios</strong>
        <div className="toolbar" role="group" aria-label="Velocidade">
          <button aria-pressed={velocidade === 'rapido'} onClick={() => setVelocidade('rapido')}>Rápido</button>
          <button aria-pressed={velocidade === 'passo'} onClick={() => setVelocidade('passo')}>Passo a passo</button>
        </div>
        <button onClick={aoFechar}>Voltar ao 3D interativo</button>
      </div>
      <div className="raios-lado-a-lado">
        <figure>
          {dados.imagemRaster && <img src={dados.imagemRaster} alt="Imagem da GPU (rasterização)" />}
          <figcaption>Rasterização (GPU): projeta cada triângulo na tela. Sem sombra projetada.</figcaption>
        </figure>
        <figure>
          <canvas ref={canvas} width={W} height={H} onClick={aoClicar} title="Clique num ponto para ver o raio" />
          <figcaption>Rastreamento de raios (nosso código): um raio por pixel + raio de sombra. Clique num ponto.</figcaption>
        </figure>
      </div>
      <div className="raios-info">
        <span>
          {pronto ? 'Pronto' : `Varrendo linha ${estado.linhas} de ${H}`} · {W}×{H} px ·{' '}
          {(estado.linhas * W).toLocaleString('pt-BR')} raios primários · {triangulos.toLocaleString('pt-BR')} triângulos ·
          BVH {cena.bvh.total.toLocaleString('pt-BR')} nós ({Math.round(msBVH)} ms) · {fmt(estado.ms / 1000)} s
        </span>
        {p ? (
          <ol className="caminho-raio" aria-label="Caminho do raio clicado">
            <li>
              Pixel ({pixel!.x}, {pixel!.y}): sai um raio da câmera {vec(dados.camera)}.
            </li>
            {p.alvo === 'fundo' ? (
              <li>Não acertou nada: cor de fundo.</li>
            ) : (
              <>
                <li>
                  A BVH descarta as caixas que o raio não cruza; o primeiro acerto é{' '}
                  {p.alvo === 'modelo' ? `o triângulo nº ${p.triangulo} do tênis` : 'o chão (y = 0)'}, a {fmt(p.t)} cm, no
                  ponto {vec(p.ponto)}, normal {vec(p.normal, 2)}.
                </li>
                <li>
                  {p.alvo === 'modelo' && p.lambert <= 0
                    ? 'A face está de costas para a luz (cos θ ≤ 0): nem é preciso lançar o raio de sombra.'
                    : `Raio de sombra até a luz: ${p.sombra ? 'BLOQUEADO — o ponto está na sombra' : 'livre — o ponto recebe luz'}.`}
                </li>
                <li>
                  {p.alvo === 'modelo'
                    ? `Cor = cor da foto naquele ponto × (${fmt(LUZ_AMBIENTE, 2)} de luz ambiente + ${fmt(1 - LUZ_AMBIENTE, 2)} × cos θ, com cos θ = ${fmt(p.lambert, 2)} entre a normal e a luz (Lambert)${p.sombra ? ' — mas o raio de sombra foi bloqueado, então só fica o ambiente' : ''})`
                    : `Cor = cor do chão × ${p.sombra ? '0,3 (na sombra do tênis)' : '1 (iluminado)'}`}{' '}
                  → <span className="amostra-cor" style={{ background: `rgb(${p.cor.map(paraSRGB).join(',')})` }} />
                </li>
              </>
            )}
          </ol>
        ) : (
          <span className="conceito">Clique em qualquer ponto da imagem da direita para ver o que o raio daquele pixel fez.</span>
        )}
      </div>
    </div>
  )
}
