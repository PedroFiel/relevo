import type { ReactNode } from 'react'
import { Botao } from './ui'

/** Página declarada (rota final) que ainda não tem conteúdo: diz o que virá e oferece um caminho. */
export default function EmConstrucao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="container pagina-simples vazio">
      <h1>{titulo}</h1>
      <p>{children}</p>
      <div className="acoes">
        <Botao para="/visualizador" variante="primario">
          Ver um exemplo
        </Botao>
        <Botao para="/guia">Guia de fotos</Botao>
      </div>
    </main>
  )
}
