import type { ReactNode } from 'react'

export type Tom = 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'info'

export default function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={tom === 'neutro' ? 'etiqueta' : `etiqueta etiqueta-${tom}`}>{children}</span>
}
