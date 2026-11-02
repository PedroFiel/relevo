import { useState } from 'react'
import { urlApi, type Imagem, type MetricasVersao } from '../lib/api'
import { ROTULOS, type Vista } from '../lib/vistas'
import EditorMascara from './EditorMascara'
import ListaAvisos from './ListaAvisos'
import VisorFoto from './VisorFoto'
import { Botao } from './ui'

type Props = {
  imagens: Imagem[]
  metricas: MetricasVersao | null
  regerando?: boolean
  erroRegerar?: string
  aoRegerarMascara?: (vista: Vista, mascaraPngBase64: string) => void
}

/**
 * Aba "Fotos" do modelo (F3-T14 + F5-T05): cada foto ENVIADA com o contorno que a segmentação achou por
 * cima (levado à foto original pela matriz 3×3 do ajuste), os avisos do pipeline e a opção de corrigir
 * a silhueta com pincel/borracha e regerar o modelo 3D.
 */
export default function FotosDoModelo({ imagens, metricas, regerando, erroRegerar, aoRegerarMascara }: Props) {
  const [camadas, setCamadas] = useState({ contorno: true, mascara: false })
  const [editandoVista, setEditandoVista] = useState<Vista | null>(null)
  const imagemEditando = editandoVista ? imagens.find((i) => i.vista === editandoVista) : null

  return (
    <div>
      <ListaAvisos avisos={metricas?.avisos ?? []} />
      {imagemEditando && aoRegerarMascara && (
        <EditorMascara
          src={urlApi(imagemEditando.url)}
          vista={imagemEditando.vista}
          largura={imagemEditando.largura_px}
          altura={imagemEditando.altura_px}
          contorno={metricas?.contornos?.[imagemEditando.vista]?.pontos}
          salvando={regerando}
          erro={erroRegerar}
          aoSalvar={(png) => aoRegerarMascara(imagemEditando.vista, png)}
          aoCancelar={() => setEditandoVista(null)}
        />
      )}
      <div className="toolbar" role="group" aria-label="Camadas">
        <label>
          <input type="checkbox" checked={camadas.contorno} onChange={(e) => setCamadas({ ...camadas, contorno: e.target.checked })} /> Contorno
        </label>
        <label>
          <input type="checkbox" checked={camadas.mascara} onChange={(e) => setCamadas({ ...camadas, mascara: e.target.checked })} /> Máscara
        </label>
      </div>
      <div className="grade-fotos">
        {imagens.map((img) => {
          const contorno = metricas?.contornos?.[img.vista]
          const ajuste = metricas?.ajustes?.[img.vista]
          return (
            <section key={img.vista} className="foto-card" aria-label={ROTULOS[img.vista]}>
              <div className="foto-card-topo">
                <h3>{ROTULOS[img.vista]}</h3>
                {aoRegerarMascara && (
                  <Botao
                    variante={editandoVista === img.vista ? 'primario' : 'secundario'}
                    onClick={() => setEditandoVista(editandoVista === img.vista ? null : img.vista)}
                    aria-label={`Corrigir com pincel ${ROTULOS[img.vista]}`}
                  >
                    {editandoVista === img.vista ? 'Fechar pincel' : 'Corrigir com pincel'}
                  </Botao>
                )}
              </div>
              <VisorFoto
                src={urlApi(img.url)}
                rotulo={`Foto ${ROTULOS[img.vista]}`}
                contorno={contorno?.pontos}
                mostrarContorno={camadas.contorno}
                mostrarMascara={camadas.mascara}
              />
              <p className="conceito">
                {img.largura_px} × {img.altura_px} px
                {ajuste?.rotacao_graus ? ` · girada ${ajuste.rotacao_graus}°` : ''}
                {ajuste?.recorte ? ` · recorte ${ajuste.recorte[2]} × ${ajuste.recorte[3]} px` : ''}
                {contorno ? ` · contorno com ${contorno.pontos.length} vértices` : ''}
              </p>
            </section>
          )
        })}
      </div>
    </div>
  )
}
