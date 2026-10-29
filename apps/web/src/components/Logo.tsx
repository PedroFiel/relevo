/** Marca do RELEVO: um cubo em perspectiva (o modelo 3D) saindo de um quadro (a foto). */
export default function Logo({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M14 3.5 21 7v8l-7 3.5L7 15V7l7-3.5Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 7l7 3.5L21 7M14 10.5v8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
