import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variante = 'primario' | 'secundario' | 'fantasma'

type Props = {
  variante?: Variante
  grande?: boolean
  /** Com `para`, vira um link do React Router com cara de botão. */
  para?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

function classesBotao(variante: Variante = 'secundario', grande = false): string {
  return ['botao', variante !== 'secundario' && `botao-${variante}`, grande && 'botao-grande']
    .filter(Boolean)
    .join(' ')
}

export default function Botao({ variante, grande, para, className, children, type = 'button', ...resto }: Props) {
  const classes = [classesBotao(variante, grande), className].filter(Boolean).join(' ')
  if (para) {
    return (
      <Link to={para} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} {...resto}>
      {children}
    </button>
  )
}
