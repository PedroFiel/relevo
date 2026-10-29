/** Ilustração da home: as silhuetas de 3 fotos (lateral, de cima, frontal) viram uma malha 3D. */
export default function IlustracaoProcesso() {
  const quadro = { width: 112, height: 76, rx: 8, fill: 'var(--surface)', stroke: 'var(--border)' }
  const silhueta = { fill: 'var(--surface-2)', stroke: 'currentColor', strokeWidth: 1.5 }
  return (
    <svg className="ilustracao" viewBox="0 0 440 300" role="img" aria-labelledby="ilus-titulo">
      <title id="ilus-titulo">Três fotos do tênis — lateral, de cima e frontal — viram um modelo 3D</title>
      <g fontSize="11" fill="var(--muted)" fontFamily="var(--fonte)">
        <rect x="8" y="16" {...quadro} />
        <path d="M24 74c4-14 10-24 24-26 10-1 18-10 24-14 6 6 16 10 26 16 6 4 6 12 6 16-30 4-56 6-80 8z" {...silhueta} />
        <text x="8" y="108">lateral</text>

        <rect x="8" y="118" {...quadro} />
        <path d="M22 156c0-10 12-16 34-16 22 0 44 4 50 16-6 12-28 16-50 16-22 0-34-6-34-16z" {...silhueta} />
        <text x="8" y="210">de cima</text>

        <rect x="8" y="220" {...quadro} height={64} />
        <path d="M44 276c0-20 6-40 20-40s20 20 20 40z" {...silhueta} />
        <text x="8" y="298">frontal</text>
      </g>

      <g stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M136 54c40 0 52 60 92 92M136 156h92M136 252c40 0 52-56 92-90" opacity="0.7" strokeDasharray="4 6" />
      </g>

      <g transform="translate(236 70)" stroke="var(--accent)" strokeWidth="1.4" fill="none" strokeLinejoin="round">
        <path d="M8 120c10-34 30-58 64-62 26-3 44-28 60-40 14 16 40 30 62 44 12 8 12 30 6 44-30 12-72 18-110 18-38 0-62-2-82-4z" fill="var(--accent)" fillOpacity="0.1" />
        <path d="M8 120l30 14c40 4 92 2 132-10l30-4" />
        <path d="M38 134c2-30 18-56 40-66M78 132c0-30 10-50 34-60M120 128c2-28 8-48 20-66M160 120c4-18 4-34 0-50M72 58l6 10M132 18l-20 54M194 62l-34 8" opacity="0.6" />
        <path d="M14 104c40 8 120 8 186-6M24 88c40 6 104 4 150-12" opacity="0.6" />
      </g>
      <text x="300" y="250" textAnchor="middle" fontSize="12" fill="var(--text)" fontWeight="600">modelo 3D em escala real</text>
    </svg>
  )
}
