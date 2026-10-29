import { useEffect, useRef } from 'react'
import type { AjusteFoto } from '../lib/vistas'

/**
 * A foto como o pipeline vai recebê-la: girada (sentido horário) e recortada. É a mesma
 * transformação do `ajuste.py`, feita com a matriz do contexto 2D do canvas.
 */
export default function MiniaturaAjustada({ src, ajuste, rotulo }: { src: string; ajuste: AjusteFoto; rotulo: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new Image()
    let ativo = true
    img.onload = () => {
      const c = canvas.current
      const ctx = c?.getContext('2d')
      if (!ativo || !c || !ctx) return
      const graus = ((ajuste.rotacao_graus % 360) + 360) % 360
      const [larg, alt] = graus % 180 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight]
      const [x, y, w, h] = ajuste.recorte ?? [0, 0, larg, alt]
      const escala = Math.min(1, 480 / Math.max(w, h))
      c.width = Math.max(1, Math.round(w * escala))
      c.height = Math.max(1, Math.round(h * escala))
      ctx.setTransform(escala, 0, 0, escala, -x * escala, -y * escala)
      ctx.translate(larg / 2, alt / 2)
      ctx.rotate((graus * Math.PI) / 180)
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    }
    img.src = src
    return () => {
      ativo = false
    }
  }, [src, ajuste.rotacao_graus, ajuste.recorte])

  return <canvas ref={canvas} className="miniatura" role="img" aria-label={rotulo} />
}
