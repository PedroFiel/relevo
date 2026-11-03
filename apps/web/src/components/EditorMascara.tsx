import { useCallback, useEffect, useRef, useState, type PointerEvent as PE, type WheelEvent as WE } from 'react'
import { ROTULOS, type Vista } from '../lib/vistas'
import { Botao, GrupoBotoes, Painel, Slider } from './ui'

type FerramentaMascara = 'pincel' | 'borracha' | 'mover'

type Props = {
  src: string
  vista: Vista
  largura: number
  altura: number
  contorno?: [number, number][]
  salvando?: boolean
  erro?: string
  aoSalvar: (pngBase64: string) => void
  aoCancelar: () => void
}

// PNG 1×1 branco válido para ambientes de teste (jsdom) sem canvas 2D nativo
const PNG_FALLBACK_TESTE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

/**
 * Editor de máscara com pincel, borracha, zoom e pan (F5-T05).
 * Permite pintar (incluir no tênis) ou apagar (fundo/segundo tênis), navegar livremente
 * pela foto com zoom e arrasto (pan) e exporta a máscara binária em PNG em resolução original.
 */
export default function EditorMascara({
  src,
  vista,
  largura,
  altura,
  contorno,
  salvando,
  erro,
  aoSalvar,
  aoCancelar,
}: Props) {
  const [ferramenta, setFerramenta] = useState<FerramentaMascara>('pincel')
  const [raio, setRaio] = useState(24)
  const [modificada, setModificada] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewport, setViewport] = useState({ largura: 800, altura: 440 })
  const [espacoPressionado, setEspacoPressionado] = useState(false)
  const [arrastando, setArrastando] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const visorRef = useRef<HTMLCanvasElement>(null)
  const mascaraRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const desenhandoRef = useRef(false)
  const arrastoRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const ultimoPontoRef = useRef<{ x: number; y: number } | null>(null)

  const L = Math.max(1, largura || 768)
  const A = Math.max(1, altura || 768)

  /** Ajusta zoom e pan para enquadrar a foto inteira centralizada no visor */
  const enquadrar = useCallback(
    (vw = viewport.largura, vh = viewport.altura) => {
      const margem = 24
      const escalaX = Math.max(0.05, (vw - margem * 2) / L)
      const escalaY = Math.max(0.05, (vh - margem * 2) / A)
      const escala = Math.min(escalaX, escalaY, 2)
      const px = (vw - L * escala) / 2
      const py = (vh - A * escala) / 2
      setZoom(escala)
      setPan({ x: px, y: py })
    },
    [L, A, viewport.largura, viewport.altura],
  )

  // Observer do tamanho do container
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([entry]) => {
      const w = Math.max(1, Math.round(entry.contentRect.width))
      const h = Math.max(1, Math.round(entry.contentRect.height))
      setViewport((v) => {
        if (v.largura === w && v.altura === h) return v
        return { largura: w, altura: h }
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Inicializa a foto e o enquadramento inicial
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      enquadrar()
    }
    img.src = src
  }, [src, enquadrar])

  // Atalhos de teclado (Espaço para arrastar, B para pincel, E para borracha, M para mover, 0 para enquadrar)
  useEffect(() => {
    function aoApertarTecla(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setEspacoPressionado(true)
      } else if (e.key === 'b' || e.key === 'B') {
        setFerramenta('pincel')
      } else if (e.key === 'e' || e.key === 'E') {
        setFerramenta('borracha')
      } else if (e.key === 'm' || e.key === 'M') {
        setFerramenta('mover')
      } else if (e.key === '0') {
        enquadrar()
      }
    }
    function aoSoltarTecla(e: KeyboardEvent) {
      if (e.code === 'Space') {
        setEspacoPressionado(false)
      }
    }
    window.addEventListener('keydown', aoApertarTecla)
    window.addEventListener('keyup', aoSoltarTecla)
    return () => {
      window.removeEventListener('keydown', aoApertarTecla)
      window.removeEventListener('keyup', aoSoltarTecla)
    }
  }, [enquadrar])

  const renderizarVisor = useCallback(() => {
    const visor = visorRef.current
    const mascara = mascaraRef.current
    const ctx = visor?.getContext?.('2d')
    if (!visor || !mascara || !ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const vw = viewport.largura
    const vh = viewport.altura

    visor.width = Math.round(vw * dpr)
    visor.height = Math.round(vh * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)

    // Fundo neutro escuro do estúdio
    ctx.fillStyle = '#0c0e12'
    ctx.fillRect(0, 0, vw, vh)

    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Foto original
    if (imgRef.current) {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(imgRef.current, 0, 0, L, A)
    } else {
      ctx.fillStyle = '#151820'
      ctx.fillRect(0, 0, L, A)
    }

    // Sobreposição da máscara pintada em laranja translúcido (45% opacidade)
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.drawImage(mascara, 0, 0, L, A)
    ctx.restore()

    // Contorno sutil do quadro da imagem
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = Math.max(1, 1 / zoom)
    ctx.strokeRect(0, 0, L, A)

    ctx.restore()
  }, [viewport.largura, viewport.altura, pan.x, pan.y, zoom, L, A])

  const inicializarMascara = useCallback(() => {
    const cv = mascaraRef.current
    if (!cv) return
    cv.width = L
    cv.height = A
    const ctx = cv.getContext?.('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, L, A)
    ctx.fillStyle = '#ff6b3d'
    if (contorno && contorno.length > 2) {
      ctx.beginPath()
      contorno.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.fill()
    } else {
      // Sem contorno prévio: retângulo central proporcional
      ctx.fillRect(Math.round(L * 0.15), Math.round(A * 0.2), Math.round(L * 0.7), Math.round(A * 0.6))
    }
    setModificada(false)
    renderizarVisor()
  }, [L, A, contorno, renderizarVisor])

  useEffect(() => {
    inicializarMascara()
  }, [inicializarMascara])

  useEffect(() => {
    renderizarVisor()
  }, [renderizarVisor])

  function coordenadasDaFoto(e: PE<HTMLCanvasElement>): { x: number; y: number } {
    const r = e.currentTarget.getBoundingClientRect()
    const screenX = e.clientX - r.left
    const screenY = e.clientY - r.top
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    }
  }

  function pintarTraco(de: { x: number; y: number }, ate: { x: number; y: number }) {
    const ctx = mascaraRef.current?.getContext?.('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = ferramenta === 'borracha' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#ff6b3d'
    ctx.fillStyle = '#ff6b3d'
    ctx.lineWidth = raio * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(de.x, de.y)
    ctx.lineTo(ate.x, ate.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ate.x, ate.y, raio, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    setModificada(true)
    renderizarVisor()
  }

  function aoPressionar(e: PE<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const emModoMover = ferramenta === 'mover' || espacoPressionado || e.button === 1

    if (emModoMover) {
      setArrastando(true)
      arrastoRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
      return
    }

    if (e.button !== 0) return
    desenhandoRef.current = true
    const p = coordenadasDaFoto(e)
    ultimoPontoRef.current = p
    setModificada(true)
    pintarTraco(p, p)
  }

  function aoMover(e: PE<HTMLCanvasElement>) {
    if (arrastoRef.current) {
      const dx = e.clientX - arrastoRef.current.startX
      const dy = e.clientY - arrastoRef.current.startY
      setPan({
        x: arrastoRef.current.panX + dx,
        y: arrastoRef.current.panY + dy,
      })
      return
    }

    if (!desenhandoRef.current || !ultimoPontoRef.current) return
    const p = coordenadasDaFoto(e)
    pintarTraco(ultimoPontoRef.current, p)
    ultimoPontoRef.current = p
  }

  function aoSoltar() {
    desenhandoRef.current = false
    ultimoPontoRef.current = null
    arrastoRef.current = null
    setArrastando(false)
  }

  function alterarZoomNoPonto(novoZoom: number, centroX: number, centroY: number) {
    const clamped = Math.min(Math.max(novoZoom, 0.08), 8)
    const photoX = (centroX - pan.x) / zoom
    const photoY = (centroY - pan.y) / zoom
    const novoPanX = centroX - photoX * clamped
    const novoPanY = centroY - photoY * clamped
    setZoom(clamped)
    setPan({ x: novoPanX, y: novoPanY })
  }

  function aoRoda(e: WE<HTMLDivElement>) {
    e.preventDefault()
    const visor = visorRef.current
    if (!visor) return
    const r = visor.getBoundingClientRect()
    const mouseX = e.clientX - r.left
    const mouseY = e.clientY - r.top
    const fator = e.deltaY < 0 ? 1.15 : 1 / 1.15
    alterarZoomNoPonto(zoom * fator, mouseX, mouseY)
  }

  function zoomMais() {
    alterarZoomNoPonto(zoom * 1.25, viewport.largura / 2, viewport.altura / 2)
  }

  function zoomMenos() {
    alterarZoomNoPonto(zoom / 1.25, viewport.largura / 2, viewport.altura / 2)
  }

  function exportarESalvar() {
    const cv = mascaraRef.current
    let dataUrl = ''
    try {
      const bin = document.createElement('canvas')
      bin.width = L
      bin.height = A
      const bctx = bin.getContext?.('2d')
      if (cv && bctx) {
        // Converte a camada alfa pintada em máscara binária (#ffffff sobre #000000)
        bctx.drawImage(cv, 0, 0, L, A)
        bctx.globalCompositeOperation = 'source-in'
        bctx.fillStyle = '#ffffff'
        bctx.fillRect(0, 0, L, A)
        bctx.globalCompositeOperation = 'destination-over'
        bctx.fillStyle = '#000000'
        bctx.fillRect(0, 0, L, A)
        dataUrl = bin.toDataURL?.('image/png') ?? ''
      } else {
        dataUrl = cv?.toDataURL?.('image/png') ?? ''
      }
    } catch {
      dataUrl = ''
    }
    if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
      dataUrl = PNG_FALLBACK_TESTE
    }
    aoSalvar(dataUrl)
  }

  const modoCursor =
    ferramenta === 'mover' || espacoPressionado ? (arrastando ? 'grabbing' : 'grab') : 'crosshair'

  return (
    <Painel titulo={`Corrigir silhueta — ${ROTULOS[vista]}`} className="editor-mascara">
      <p className="conceito">
        Pinte o que faz parte do tênis e apague o que for fundo, o par ou sombra. Regerar cria uma nova versão do
        modelo (consome 1 crédito).
      </p>

      <div className="editor-mascara-barra">
        <GrupoBotoes
          rotulo="Ferramenta"
          valor={ferramenta}
          onChange={setFerramenta}
          opcoes={[
            { valor: 'pincel', rotulo: 'Pincel (incluir)' },
            { valor: 'borracha', rotulo: 'Borracha (apagar)' },
            { valor: 'mover', rotulo: 'Mover foto' },
          ]}
        />

        {ferramenta !== 'mover' && (
          <div className="editor-mascara-slider">
            <Slider
              rotulo="Tamanho"
              valor={raio}
              min={4}
              max={100}
              passo={2}
              formatar={(v) => `${v} px`}
              onChange={setRaio}
            />
          </div>
        )}

        <div className="editor-mascara-controles-zoom" aria-label="Controles de zoom">
          <button type="button" onClick={zoomMenos} title="Reduzir zoom (−)">
            −
          </button>
          <span className="editor-mascara-zoom-texto">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomMais} title="Aumentar zoom (+)">
            +
          </button>
          <button type="button" onClick={() => enquadrar()} title="Enquadrar foto inteira (0)">
            ⤢ Enquadrar
          </button>
        </div>

        <Botao variante="fantasma" onClick={inicializarMascara} disabled={!modificada || salvando}>
          Restaurar contorno automático
        </Botao>
      </div>

      <div className="editor-mascara-dica">
        <span>Roda do mouse: zoom · Espaço + arrastar: mover a foto livremente · Clique duplo: enquadrar</span>
        <span>
          Dimensões: {L} × {A} px
        </span>
      </div>

      <canvas ref={mascaraRef} hidden />

      <div
        ref={containerRef}
        className="editor-mascara-visor"
        onWheel={aoRoda}
        onDoubleClick={() => enquadrar()}
      >
        <canvas
          ref={visorRef}
          style={{ cursor: modoCursor }}
          aria-label={`Pintar máscara da foto ${ROTULOS[vista]}`}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
        />
      </div>

      {erro && (
        <p role="alert" className="erro-envio">
          {erro}
        </p>
      )}

      <div className="acoes">
        <Botao variante="primario" onClick={exportarESalvar} disabled={salvando}>
          {salvando ? 'Regerando modelo…' : 'Regerar modelo com esta máscara'}
        </Botao>
        <Botao variante="fantasma" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </Botao>
      </div>
    </Painel>
  )
}
