import { useState } from 'react'
import { useUrlDoArquivo } from '../lib/useUrlDoArquivo'
import { ROTULOS, SEM_AJUSTE, type AjusteFoto, type Vista } from '../lib/vistas'
import { Botao, GrupoBotoes } from './ui'
import VisorFoto from './VisorFoto'

type Props = { vista: Vista; arquivo: File; ajuste: AjusteFoto; onMudar: (a: AjusteFoto) => void; onFechar: () => void }

/**
 * Editor da foto no upload (F3-T13): girar 90°, recortar (retângulo recortado contra a foto) e
 * ampliar/arrastar — o `VisorFoto` (F2-T10) em modo edição.
 */
export default function EditorFoto({ vista, arquivo, ajuste, onMudar, onFechar }: Props) {
  const [ferramenta, setFerramenta] = useState<'recortar' | 'mover'>('recortar')
  const url = useUrlDoArquivo(arquivo)

  // Girar muda o sistema de coordenadas da foto exibida: o recorte antigo deixa de valer
  const girar = (delta: number) =>
    onMudar({ rotacao_graus: (((ajuste.rotacao_graus + delta) % 360) + 360) % 360, recorte: null })

  return (
    <section className="editor-foto painel-ui" aria-label={`Ajustar a foto ${ROTULOS[vista]}`}>
      <div className="editor-topo">
        <h2>Ajustar: {ROTULOS[vista]}</h2>
        <Botao variante="primario" onClick={onFechar}>
          Concluir
        </Botao>
      </div>
      <div className="editor-ferramentas">
        <Botao onClick={() => girar(-90)} aria-label="Girar 90° anti-horário">↺ 90°</Botao>
        <Botao onClick={() => girar(90)} aria-label="Girar 90° horário">↻ 90°</Botao>
        <GrupoBotoes
          rotulo="Ferramenta"
          valor={ferramenta}
          onChange={setFerramenta}
          opcoes={[
            { valor: 'recortar', rotulo: 'Recortar' },
            { valor: 'mover', rotulo: 'Mover / ampliar' },
          ]}
        />
        <Botao variante="fantasma" onClick={() => onMudar(SEM_AJUSTE)}>
          Restaurar
        </Botao>
      </div>
      {url && (
        <div className="editor-visor">
          <VisorFoto src={url} rotulo={`Foto ${ROTULOS[vista]}`} edicao={{ ajuste, ferramenta, aoMudar: onMudar }} />
        </div>
      )}
      <p className="conceito">
        Arraste um retângulo em volta de <strong>um</strong> tênis para tirar do quadro o par, uma caixa ou o pé. A roda do
        mouse (ou o gesto de pinça) amplia no ponto; em "Mover" você arrasta a foto.
        {ajuste.rotacao_graus ? ` Girada ${ajuste.rotacao_graus}° no sentido horário.` : ''}
        {ajuste.recorte ? ` Recorte de ${ajuste.recorte[2]} × ${ajuste.recorte[3]} px.` : ''}
      </p>
    </section>
  )
}
