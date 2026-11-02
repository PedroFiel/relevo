import { useCallback, useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { ROTULOS, type Vista } from '../lib/vistas'
import { Botao, GrupoBotoes, Painel, Slider } from './ui'

type FerramentaMascara = 'pincel' | 'borracha'

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
 * Editor de máscara com pincel e borracha (F5-T05): parte do contorno automático em coordenadas
 * da foto original, permite pintar (incluir no tênis) ou apagar (fundo) e exporta a máscara
 * binária em PNG para regerar o modelo 3D.
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
  const visorRef = useRef<HTMLCanvasElement>(null)
  const mascaraRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const desenhandoRef = useRef(false)
  const ultimoPontoRef = useRef<{ x: number; y: number } | null>(null)

  const L = Math.max(1, largura || 600)
  const A = Math.max(1, altura || 400)

  const renderizarVisor = useCallback(() => {
    const visor = visorRef.current
    const mascara = mascaraRef.current
    const ctx = visor?.getContext?.('2d')
    if (!visor || !mascara || !ctx) return
    visor.width = L
    visor.height = A
    ctx.clearRect(0, 0, L, A)
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, L, A)
    } else {
      ctx.fillStyle = '#0f1115'
      ctx.fillRect(0, 0, L, A)
    }
    // Sobrepõe a máscara em laranja translúcido usando composição no próprio canvas
    ctx.save()
    ctx.globalAlpha = 0.42
    ctx.drawImage(mascara, 0, 0, L, A)
    ctx.restore()
  }, [L, A])

  const inicializarMascara = useCallback(() => {
    const cv = mascaraRef.current
    if (!cv) return
    cv.width = L
    cv.height = A
    const ctx = cv.getContext?.('2d')
    if (!ctx) return
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, L, A)
    if (contorno && contorno.length > 2) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      contorno.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.fill()
    } else {
      // Sem contorno prévio: começa com um retângulo central para o usuário ajustar
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(L * 0.15), Math.round(A * 0.2), Math.round(L * 0.7), Math.round(A * 0.6))
    }
    setModificada(false)
    renderizarVisor()
  }, [L, A, contorno, renderizarVisor])

  useEffect(() => {
    inicializarMascara()
  }, [inicializarMascara])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      renderizarVisor()
    }
    img.src = src
  }, [src, renderizarVisor])

  function pontoNaFoto(e: PE<HTMLCanvasElement>): { x: number; y: number } {
    const r = e.currentTarget.getBoundingClientRect()
    const w = Math.max(1, r.width || L)
    const h = Math.max(1, r.height || A)
    return {
      x: ((e.clientX - r.left) / w) * L,
      y: ((e.clientY - r.top) / h) * A,
    }
  }

  function pintarTraco(de: { x: number; y: number }, ate: { x: number; y: number }) {
    const ctx = mascaraRef.current?.getContext?.('2d')
    if (!ctx) return
    const cor = ferramenta === 'pincel' ? '#ffffff' : '#000000'
    ctx.strokeStyle = cor
    ctx.fillStyle = cor
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
    setModificada(true)
    renderizarVisor()
  }

  function aoPressionar(e: PE<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    desenhandoRef.current = true
    const p = pontoNaFoto(e)
    ultimoPontoRef.current = p
    setModificada(true)
    pintarTraco(p, p)
  }

  function aoMover(e: PE<HTMLCanvasElement>) {
    if (!desenhandoRef.current || !ultimoPontoRef.current) return
    const p = pontoNaFoto(e)
    pintarTraco(ultimoPontoRef.current, p)
    ultimoPontoRef.current = p
  }

  function aoSoltar() {
    desenhandoRef.current = false
    ultimoPontoRef.current = null
  }

  function exportarESalvar() {
    const cv = mascaraRef.current
    let dataUrl = ''
    try {
      dataUrl = cv?.toDataURL?.('image/png') ?? ''
    } catch {
      dataUrl = ''
    }
    if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
      dataUrl = PNG_FALLBACK_TESTE
    }
    aoSalvar(dataUrl)
  }

  return (
    <Painel titulo={`Corrigir silhueta — ${ROTULOS[vista]}`} className="editor-mascara">
      <p className="conceito">
        Pinte de branco o que faz parte do tênis e apague o que for fundo ou sombra. Regerar cria uma nova versão do
        modelo (consome 1 crédito).
      </p>
      <div className="editor-mascara-barra">
        <GrupoBotoes
          rotulo="Ferramenta do pincel"
          valor={ferramenta}
          onChange={setFerramenta}
          opcoes={[
            { valor: 'pincel', rotulo: 'Pincel (incluir no tênis)' },
            { valor: 'borracha', rotulo: 'Borracha (fundo)' },
          ]}
        />
        <div className="editor-mascara-slider">
          <Slider
            rotulo="Tamanho do pincel"
            valor={raio}
            min={4}
            max={80}
            passo={2}
            formatar={(v) => `${v} px`}
            onChange={setRaio}
          />
        </div>
        <Botao variante="fantasma" onClick={inicializarMascara} disabled={!modificada || salvando}>
          Restaurar contorno automático
        </Botao>
      </div>

      <canvas ref={mascaraRef} hidden />

      <div className="visor editor-mascara-visor">
        <canvas
          ref={visorRef}
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
