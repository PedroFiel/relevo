/** Avisos do pipeline em linguagem simples (valor "transparência"): o que corrigimos e o que atrapalhou. */
export default function ListaAvisos({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return <p className="conceito">Nenhum problema nas fotos.</p>
  return (
    <ul className="avisos" aria-label="Avisos">
      {avisos.map((a) => (
        <li key={a}>{a}</li>
      ))}
    </ul>
  )
}
