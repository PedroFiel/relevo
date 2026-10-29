import { Link } from 'react-router-dom'
import IlustracaoProcesso from '../components/IlustracaoProcesso'
import { Botao, Etiqueta, Painel } from '../components/ui'
import { LIMITES } from '../lib/guiaFotos'

const PASSOS = [
  {
    titulo: 'Tire as fotos',
    texto: 'Lateral e de cima são obrigatórias; a frontal deixa o formato melhor. Até 6 fotos, com fundo liso.',
    icone: (
      <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    ),
  },
  {
    titulo: 'A gente processa',
    texto: 'Separamos o tênis do fundo, cruzamos as silhuetas e esculpimos o volume. Você acompanha cada etapa.',
    icone: <path d="M4 7h16M4 12h10M4 17h6M17 14l3 3-3 3" />,
  },
  {
    titulo: 'Baixe o modelo 3D',
    texto: 'Colorido, fechado e no tamanho real informado. Arquivo .glb pronto para loja virtual — sem marca d’água.',
    icone: <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3zM4 7.5 12 12l8-4.5M12 12v9" />,
  },
]

export default function Home() {
  return (
    <main>
      <section className="container heroi">
        <div>
          <Etiqueta tom="info">Computação gráfica clássica · sem IA</Etiqueta>
          <h1>
            Fotos do seu tênis viram um <em>modelo 3D</em> em escala real.
          </h1>
          <p className="missao">
            O RELEVO converte imagens em modelos 3D prontos para uso, em segundos — sem software de modelagem e sem o
            custo de contratar um modelador.
          </p>
          <div className="acoes">
            <Botao para="/novo" variante="primario" grande>
              Criar modelo
            </Botao>
            <Botao para="/visualizador" grande>
              Ver um exemplo
            </Botao>
          </div>
          <div className="selos">
            <Etiqueta>.glb</Etiqueta>
            <Etiqueta>escala real em cm</Etiqueta>
            <Etiqueta>~20 mil faces</Etiqueta>
            <Etiqueta>o modelo é seu</Etiqueta>
          </div>
        </div>
        <IlustracaoProcesso />
      </section>

      <section className="container secao" aria-labelledby="como-funciona">
        <h2 id="como-funciona">Como funciona</h2>
        <p className="subtitulo">Três passos, do celular ao arquivo 3D.</p>
        <ol className="passos">
          {PASSOS.map((p) => (
            <li key={p.titulo} className="passo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {p.icone}
              </svg>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container secao" aria-labelledby="transparencia">
        <h2 id="transparencia">Sem mágica: o que dá e o que não dá</h2>
        <p className="subtitulo">
          Não usamos inteligência artificial. O modelo sai de técnicas de computação gráfica que dá para explicar passo
          a passo — e por isso sabemos exatamente onde elas param.
        </p>
        <div className="transparencia">
          <Painel titulo="O que você recebe">
            <ul>
              <li><strong>Malha fechada</strong>, pronta para visualizar ou imprimir.</li>
              <li><strong>Tamanho real</strong>: você informa o comprimento em cm, o modelo sai nele.</li>
              <li><strong>Cor das próprias fotos</strong>, projetada em cada ponto do modelo.</li>
              <li><strong>Avisos claros</strong> quando alguma foto atrapalhou.</li>
            </ul>
          </Painel>
          <Painel titulo="O que o algoritmo não consegue">
            <ul>
              {LIMITES.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Painel>
        </div>
        <p>
          Fotos boas fazem quase toda a diferença: <Link to="/guia">veja o guia de fotos</Link>.
        </p>
      </section>

      <section className="container chamada-final">
        <h2>Pronto para testar com o seu tênis?</h2>
        <Botao para="/novo" variante="primario" grande>
          Criar modelo
        </Botao>
      </section>
    </main>
  )
}
