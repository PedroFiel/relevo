type Opcao<T extends string> = { valor: T; rotulo: string }

type Props<T extends string> = {
  /** Nome do grupo para leitores de tela. */
  rotulo: string
  opcoes: Opcao<T>[]
  valor: T
  onChange: (valor: T) => void
}

/** Botões segmentados: uma opção ativa por vez (aria-pressed). */
export default function GrupoBotoes<T extends string>({ rotulo, opcoes, valor, onChange }: Props<T>) {
  return (
    <div className="grupo-botoes" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => onChange(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
