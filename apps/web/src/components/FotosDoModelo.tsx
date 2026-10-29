import { useState } from 'react'
import { urlApi, type Imagem, type MetricasVersao } from '../lib/api'
import { ROTULOS } from '../lib/vistas'
import ListaAvisos from './ListaAvisos'
import VisorFoto from './VisorFoto'

/**
 * Aba "Fotos" do modelo (F3-T14): cada foto ENVIADA com o contorno que a segmentação achou por
 * cima (levado à foto original pela matriz 3×3 do ajuste) e os avisos do pipeline.
 */
export default function FotosDoModelo({ imagens, metricas }: { imagens: Imagem[]; metricas: MetricasVersao | null }) {
  const [camadas, setCamadas] = useState({ contorno: true, mascara: false })
  return (
    <div>
      <ListaAvisos avisos={metricas?.avisos ?? []} />
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
              <h3>{ROTULOS[img.vista]}</h3>
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
