import { Botao } from '../components/ui'

export default function NaoEncontrada() {
  return (
    <main className="container pagina-simples vazio">
      <h1>Página não encontrada</h1>
      <p>O endereço pode ter mudado. Volte ao início ou crie um modelo novo.</p>
      <div className="acoes">
        <Botao para="/" variante="primario">
          Ir para o início
        </Botao>
      </div>
    </main>
  )
}
