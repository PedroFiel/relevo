import { useId } from 'react'

type Props = {
  rotulo: string
  valor: number
  min: number
  max: number
  passo?: number
  /** Texto mostrado ao lado do rótulo (padrão: o próprio número). */
  formatar?: (valor: number) => string
  onChange: (valor: number) => void
}

export default function Slider({ rotulo, valor, min, max, passo = 1, formatar = String, onChange }: Props) {
  const id = useId()
  return (
    <div className="slider">
      <div className="slider-topo">
        <label htmlFor={id}>{rotulo}</label>
        <output htmlFor={id}>{formatar(valor)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
