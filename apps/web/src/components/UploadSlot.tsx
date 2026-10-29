import { useId, useState, type DragEvent } from 'react'
import { DICAS, validarFoto } from '../lib/upload'
import { useUrlDoArquivo } from '../lib/useUrlDoArquivo'
import { ROTULOS, type AjusteFoto, type Vista } from '../lib/vistas'
import Gabarito from './Gabarito'
import MiniaturaAjustada from './MiniaturaAjustada'
import { Botao, Etiqueta } from './ui'

type Props = {
  vista: Vista
  obrigatoria?: boolean
  arquivo?: File
  ajuste: AjusteFoto
  onArquivo: (arquivo: File | null) => void
  onAjustar: () => void
}

/** Lugar de uma foto no upload (F3-T08): gabarito vazio, clique ou arraste, miniatura já ajustada. */
export default function UploadSlot({ vista, obrigatoria, arquivo, ajuste, onArquivo, onAjustar }: Props) {
  const id = useId()
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const url = useUrlDoArquivo(arquivo)

  function escolher(f: File | undefined) {
    if (!f) return
    const problema = validarFoto(f)
    setErro(problema ?? '')
    if (!problema) onArquivo(f)
  }
  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setArrastando(false)
    escolher(e.dataTransfer.files?.[0])
  }

  const ajustada = ajuste.rotacao_graus % 360 !== 0 || ajuste.recorte !== null
  return (
    <div className={`slot${arquivo ? ' cheio' : ''}${erro ? ' com-erro' : ''}`}>
      <div className="slot-topo">
        <strong>{ROTULOS[vista]}</strong>
        <Etiqueta tom={obrigatoria ? 'aviso' : vista === 'frente' ? 'info' : 'neutro'}>
          {obrigatoria ? 'obrigatória' : vista === 'frente' ? 'recomendada' : 'opcional'}
        </Etiqueta>
      </div>
      <label
        htmlFor={id}
        className={`slot-area${arrastando ? ' arrastando' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
      >
        {arquivo && url ? (
          <MiniaturaAjustada src={url} ajuste={ajuste} rotulo={`Foto ${ROTULOS[vista]}`} />
        ) : (
          <>
            <Gabarito vista={vista} />
            <span className="slot-convite">Toque para escolher ou arraste a foto</span>
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label={`Foto ${ROTULOS[vista]}`}
        onChange={(e) => {
          escolher(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {erro ? (
        <p className="slot-erro" role="alert">{erro}</p>
      ) : (
        <p className="slot-dica">{arquivo ? arquivo.name : DICAS[vista]}</p>
      )}
      {arquivo && (
        <div className="slot-acoes">
          <Botao onClick={onAjustar}>{ajustada ? 'Ajustada · editar' : 'Ajustar'}</Botao>
          <Botao variante="fantasma" onClick={() => onArquivo(null)}>
            Remover
          </Botao>
        </div>
      )}
    </div>
  )
}
