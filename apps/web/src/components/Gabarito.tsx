import type { Vista } from '../lib/vistas'

// Silhuetas esperadas em cada vista (calcanhar à esquerda, bico à direita), em 120 × 80.
const LATERAL = 'M14 62c3-12 8-22 20-24 10-2 16-12 22-18 8 8 22 14 36 22 10 6 12 12 12 18-28 6-62 6-90 2z'
const TOPO = 'M14 40c0-10 12-14 30-14 26 0 52 4 62 14-8 12-36 16-62 16-18 0-30-6-30-16z'
const FRENTE = 'M40 68c0-24 8-46 20-46s20 22 20 46z'
const TRAS = 'M38 68c0-20 6-42 22-42s22 22 22 42z'

const FORMAS: Record<Vista, { d: string; espelhar?: boolean }> = {
  lateral: { d: LATERAL },
  outro_lado: { d: LATERAL, espelhar: true },
  topo: { d: TOPO },
  sola: { d: TOPO },
  frente: { d: FRENTE },
  tras: { d: TRAS },
}

/** Gabarito da foto (F3-T08): mostra a posição esperada do tênis antes de escolher a foto. */
export default function Gabarito({ vista }: { vista: Vista }) {
  const { d, espelhar } = FORMAS[vista]
  return (
    <svg className="gabarito" viewBox="0 0 120 80" aria-hidden="true">
      <line x1="4" y1="70" x2="116" y2="70" stroke="currentColor" strokeOpacity="0.25" />
      <path
        d={d}
        transform={espelhar ? 'translate(120 0) scale(-1 1)' : undefined}
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    </svg>
  )
}
