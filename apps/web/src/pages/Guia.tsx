import { Botao, Etiqueta } from '../components/ui'
import { LIMITES, REGRAS_DE_OURO, VISTAS_GUIA } from '../lib/guiaFotos'

const TOM = { obrigatória: 'aviso', recomendada: 'info', opcional: 'neutro' } as const

export default function Guia() {
  return (
    <main className="container pagina-simples">
      <h1>Guia de fotos</h1>
      <p>A qualidade do modelo depende quase só das fotos. Seis regras resolvem quase tudo:</p>
      <ol className="regras">
        {REGRAS_DE_OURO.map((r) => (
          <li key={r.titulo}>
            <strong>{r.titulo}.</strong> {r.texto}
          </li>
        ))}
      </ol>

      <h2>As vistas</h2>
      <p>Um tênis por foto. Foto do par atrapalha — se só tiver essa, recorte para deixar um tênis só.</p>
      <div className="tabela-rolagem">
        <table className="guia-tabela">
          <thead>
            <tr>
              <th>Vista</th>
              <th>Como posicionar</th>
              <th>Na foto</th>
            </tr>
          </thead>
          <tbody>
            {VISTAS_GUIA.map((v) => (
              <tr key={v.nome}>
                <td>
                  {v.nome} <Etiqueta tom={TOM[v.exigencia]}>{v.exigencia}</Etiqueta>
                </td>
                <td>{v.como}</td>
                <td>{v.naFoto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Por que mais de uma foto</h2>
      <p>
        Cada foto mostra só duas medidas: a lateral mostra comprimento e altura; a de cima, comprimento e largura; a
        frontal, largura e altura. O RELEVO cruza as fotos para descobrir a forma 3D.
      </p>

      <h2>O que esperar</h2>
      <ul className="regras">
        {LIMITES.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p>Se uma foto vier girada ou espelhada, o RELEVO acerta sozinho e avisa o que fez.</p>
      <div className="acoes">
        <Botao para="/novo" variante="primario">
          Criar modelo
        </Botao>
      </div>
    </main>
  )
}
