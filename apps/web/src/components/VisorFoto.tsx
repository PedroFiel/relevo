import { useEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react'
import {
  LADO_MINIMO_PX,
  ampliacao,
  enquadrar,
  encolher,
  limitarAImagem,
  matrizJanelaViewport,
  matrizRotacaoHoraria,
  multiplicar,
  normalizarRetangulo,
  pan,
  poligonoNaTela,
  tamanhoGirado,
  telaParaMundo,
  zoomEmTorno,
  type Janela,
  type Ponto,
  type Retangulo,
  type Tamanho,
} from '../lib/visualizacao2d'
import type { AjusteFoto } from '../lib/vistas'

type Props = {
  src: string
  rotulo: string
  /** Contorno rastreado pelo pipeline, em pixels da foto ORIGINAL. */
  contorno?: [number, number][]
  mostrarContorno?: boolean
  mostrarMascara?: boolean
  /** Modo didático: a janela de recorte fica menor que a tela e o que ela descarta aparece tracejado. */
  didatico?: boolean
  /** Edição (girar/recortar). Sem isso, o visor só amplia e arrasta. */
  edicao?: { ajuste: AjusteFoto; aoMudar: (a: AjusteFoto) => void; ferramenta: 'mover' | 'recortar' }
}

const AMPLIACAO_MAX = 16
const COR = '#ff6b3d'

/**
 * Visor 2D de foto (F2-T10): pipeline de visualização janela → viewport, zoom no cursor, pan e
 * recorte de polígonos feito por nós (Sutherland–Hodgman) antes de rasterizar no canvas.
 */
export default function VisorFoto({ src, rotulo, contorno, mostrarContorno = true, mostrarMascara, didatico, edicao }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [viewport, setViewport] = useState<Tamanho>({ largura: 320, altura: 280 })
  // A janela que o usuário ampliou/arrastou vale só para a mesma foto, rotação e tamanho de visor;
  // se algo disso muda, volta a ser a janela "enquadrada" (derivada, sem efeito colateral).
  const [escolhida, setEscolhida] = useState<{ chave: string; janela: Janela } | null>(null)
  const [arrasto, setArrasto] = useState<{ inicio: Ponto; atual: Ponto; janela: Janela; tela: Ponto } | null>(null)
  const [aviso, setAviso] = useState('')

  const rotacao = edicao?.ajuste.rotacao_graus ?? 0
  const original = useMemo<Tamanho | null>(
    () => (img ? { largura: img.naturalWidth, altura: img.naturalHeight } : null),
    [img],
  )
  const exibida = original ? tamanhoGirado(rotacao, original) : null
  const referencia = exibida ? enquadrar(exibida, viewport) : null
  const chave = `${src}|${rotacao}|${viewport.largura}x${viewport.altura}`
  const janela = escolhida?.chave === chave ? escolhida.janela : referencia
  const setJanela = (j: Janela) => setEscolhida({ chave, janela: j })
  const enquadrarAgora = () => setEscolhida(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = src
  }, [src])

  // Tamanho do canvas acompanha a caixa (layout responsivo, 375 px no celular)
  useEffect(() => {
    const el = caixa.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([e]) =>
      setViewport({ largura: Math.max(1, e.contentRect.width), altura: Math.max(1, e.contentRect.height) }),
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ---------- Desenho ----------
  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !img || !original || !janela) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(viewport.largura * dpr)
    cv.height = Math.round(viewport.altura * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewport.largura, viewport.altura)

    // Foto: M = (janela → viewport) · (rotação do editor). O canvas recebe a mesma matriz afim.
    const mRot = matrizRotacaoHoraria(rotacao, original)
    const m = multiplicar(matrizJanelaViewport(janela, viewport), mRot)
    ctx.save()
    ctx.transform(m[0], m[3], m[1], m[4], m[2], m[5])
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0)
    ctx.restore()

    const recorteJanela = didatico ? encolher(janela, 0.7) : janela
    if (contorno && contorno.length > 2 && (mostrarContorno || mostrarMascara)) {
      if (didatico) {
        // Polígono inteiro, tracejado: é o que o recorte vai descartar fora da janela
        const inteiro = poligonoNaTela(contorno, mRot, janela, viewport, { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 })
        tracar(ctx, inteiro)
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = '#4c8dff' // azul: aparece em fundo claro e escuro
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }
      const visivel = poligonoNaTela(contorno, mRot, janela, viewport, recorteJanela)
      if (visivel.length > 2) {
        tracar(ctx, visivel)
        if (mostrarMascara) {
          ctx.fillStyle = 'rgba(255,107,61,0.28)'
          ctx.fill()
        }
        if (mostrarContorno) {
          ctx.strokeStyle = COR
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }
    if (didatico) {
      const mt = matrizJanelaViewport(janela, viewport)
      const a = { x: mt[0] * recorteJanela.x0 + mt[2], y: mt[4] * recorteJanela.y0 + mt[5] }
      const b = { x: mt[0] * recorteJanela.x1 + mt[2], y: mt[4] * recorteJanela.y1 + mt[5] }
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.5
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
      ctx.fillStyle = '#ffd166'
      ctx.font = '12px system-ui'
      ctx.fillText('janela de recorte', a.x + 4, a.y - 4)
    }

    // Retângulo de recorte do editor (em pixels da foto girada); escurece o que fica de fora
    const r = arrasto && edicao?.ferramenta === 'recortar' ? normalizarRetangulo(arrasto.inicio, arrasto.atual) : retDoAjuste(edicao?.ajuste)
    if (edicao && r) {
      const mt = matrizJanelaViewport(janela, viewport)
      const x = mt[0] * r.x + mt[2]
      const y = mt[4] * r.y + mt[5]
      const w = mt[0] * r.largura
      const h = mt[4] * r.altura
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.rect(0, 0, viewport.largura, viewport.altura)
      ctx.rect(x, y, w, h)
      ctx.fill('evenodd')
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, w, h)
    }
  }, [img, original, janela, viewport, rotacao, contorno, mostrarContorno, mostrarMascara, didatico, arrasto, edicao])

  // ---------- Interação ----------
  function pontoTela(e: { clientX: number; clientY: number }): Ponto {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function ampliar(fator: number, telaP?: Ponto) {
    if (!janela || !referencia) return
    const p = telaParaMundo(janela, viewport, telaP ?? { x: viewport.largura / 2, y: viewport.altura / 2 })
    const nova = zoomEmTorno(janela, p, fator)
    const amp = ampliacao(nova, referencia)
    if (amp < 0.5 || amp > AMPLIACAO_MAX) return
    setJanela(nova)
  }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    function roda(e: WheelEvent) {
      e.preventDefault()
      ampliar(Math.exp(-e.deltaY * 0.0015), pontoTela(e))
    }
    cv.addEventListener('wheel', roda, { passive: false })
    return () => cv.removeEventListener('wheel', roda)
  })

  function aoPressionar(e: PE<HTMLCanvasElement>) {
    if (!janela) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const tela = pontoTela(e)
    const mundo = telaParaMundo(janela, viewport, tela)
    setArrasto({ inicio: mundo, atual: mundo, janela, tela })
  }

  function aoMover(e: PE<HTMLCanvasElement>) {
    if (!arrasto) return
    const tela = pontoTela(e)
    if (edicao?.ferramenta === 'recortar') {
      setArrasto({ ...arrasto, atual: telaParaMundo(arrasto.janela, viewport, tela) })
    } else {
      // Pan: desloca a janela pelo arrasto, convertido de pixels de tela para pixels da foto
      const k = (arrasto.janela.x1 - arrasto.janela.x0) / viewport.largura
      setJanela(pan(arrasto.janela, -(tela.x - arrasto.tela.x) * k, -(tela.y - arrasto.tela.y) * k))
    }
  }

  function aoSoltar() {
    if (arrasto && edicao?.ferramenta === 'recortar' && exibida) {
      const r = limitarAImagem(normalizarRetangulo(arrasto.inicio, arrasto.atual), exibida)
      if (r.largura >= LADO_MINIMO_PX && r.altura >= LADO_MINIMO_PX) {
        setAviso('')
        edicao.aoMudar({ ...edicao.ajuste, recorte: [r.x, r.y, r.largura, r.altura] })
      } else if (r.largura > 2 || r.altura > 2) {
        setAviso(`Recorte pequeno demais: desenhe pelo menos ${LADO_MINIMO_PX} × ${LADO_MINIMO_PX} px em volta do tênis.`)
      }
    }
    setArrasto(null)
  }

  return (
    <div>
      <div ref={caixa} className={`visor${edicao?.ferramenta === 'recortar' ? ' editando' : ''}`}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={rotulo}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onDoubleClick={enquadrarAgora}
        />
      </div>
      <div className="toolbar" style={{ marginTop: 6 }}>
        <button onClick={() => ampliar(1.5)} aria-label="Ampliar">＋</button>
        <button onClick={() => ampliar(1 / 1.5)} aria-label="Reduzir">－</button>
        <button onClick={enquadrarAgora}>Enquadrar</button>
        {janela && referencia && <span className="leitura">{ampliacao(janela, referencia).toFixed(1)}×</span>}
      </div>
      {aviso && <p role="alert" className="conceito" style={{ color: 'var(--accent)' }}>{aviso}</p>}
    </div>
  )
}

function tracar(ctx: CanvasRenderingContext2D, pontos: Ponto[]) {
  ctx.beginPath()
  pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
}

function retDoAjuste(a?: AjusteFoto): Retangulo | null {
  if (!a?.recorte) return null
  const [x, y, largura, altura] = a.recorte
  return { x, y, largura, altura }
}
