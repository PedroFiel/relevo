import type { ReactNode } from 'react'

type Props = { titulo?: string; className?: string; children: ReactNode }

export default function Painel({ titulo, className, children }: Props) {
  return (
    <section className={['painel-ui', className].filter(Boolean).join(' ')}>
      {titulo && <h2>{titulo}</h2>}
      {children}
    </section>
  )
}
