import { useEffect, useState } from 'react'
import { urlApi, type Imagem, type Versao } from '../lib/api'
import { INTERVALO_APRESENTACAO_MS, arquivosDoRaioX, passosDoRaioX } from '../lib/raioX'
import { ROTULOS, type Vista } from '../lib/vistas'
import CenaRaioX from './CenaRaioX'
import { Botao } from './ui'

/**
 * Raio-X do pipeline (F5-T01): um slider passa por cada etapa — fotos, silhuetas, voxels, malha
 * bruta, decimada e final — com a explicação do algoritmo. "Apresentação" avança sozinho a cada 4 s.
 */
export default function RaioX({ imagens, versao }: { imagens: Imagem[]; versao: Versao }) {
  const arquivos = arquivosDoRaioX(versao.arquivos)
  const passos = passosDoRaioX(imagens, arquivos, versao.metricas)
  const [indice, setIndice] = useState(0)
  const [apresentando, setApresentando] = useState(false)
  const total = passos.length

  useEffect(() => {
    if (!apresentando || total < 2) return
    const relogio = setInterval(() => setIndice((i) => (i + 1) % total), INTERVALO_APRESENTACAO_MS)
    return () => clearInterval(relogio)
  }, [apresentando, total])

  if (total === 0) return <p className="conceito">Este modelo não tem as etapas guardadas.</p>
  const atual = passos[Math.min(indice, total - 1)]
  const ir = (i: number) => setIndice(((i % total) + total) % total)
  const tem3d = passos.some((p) => p.tipo === '3d')

  return (
    <div className="raio-x">
      <div className="raio-x-palco">
        {tem3d && (
          <div className={`camada${atual.tipo === '3d' ? ' visivel' : ''}`} aria-hidden={atual.tipo !== '3d'}>
            <CenaRaioX
              passo={atual.id}
              voxels={arquivos.voxels && urlApi(arquivos.voxels.url)}
              bruta={arquivos.bruta && urlApi(arquivos.bruta.url)}
              final={arquivos.glb && urlApi(arquivos.glb.url)}
              ladoVoxel={versao.metricas?.tamanho_voxel_cm || 0.25}
            />
          </div>
        )}
        <div className={`camada camada-2d${atual.id === 'fotos' ? ' visivel' : ''}`} aria-hidden={atual.id !== 'fotos'}>
          {imagens.map((img) => (
            <figure key={img.vista}>
              <img src={urlApi(img.url)} alt={`Foto ${ROTULOS[img.vista]}`} />
              <figcaption>{ROTULOS[img.vista]}</figcaption>
            </figure>
          ))}
        </div>
        <div className={`camada camada-2d mascaras${atual.id === 'mascaras' ? ' visivel' : ''}`} aria-hidden={atual.id !== 'mascaras'}>
          {arquivos.mascaras.map((m) => (
            <figure key={m.vista}>
              <img src={urlApi(m.arquivo.url)} alt={`Silhueta ${ROTULOS[m.vista as Vista] ?? m.vista}`} />
              <figcaption>{ROTULOS[m.vista as Vista] ?? m.vista}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="raio-x-controles">
        <input
          type="range"
          min={0}
          max={total - 1}
          step={1}
          value={indice}
          aria-label="Etapa do pipeline"
          aria-valuetext={`${indice + 1} de ${total}: ${atual.titulo}`}
          onChange={(e) => {
            setApresentando(false)
            ir(Number(e.target.value))
          }}
        />
        <ol className="raio-x-marcas">
          {passos.map((p, i) => (
            <li key={p.id}>
              <button type="button" aria-current={i === indice ? 'step' : undefined} onClick={() => { setApresentando(false); ir(i) }}>
                <span>{i + 1}</span> {p.titulo}
              </button>
            </li>
          ))}
        </ol>
        <div className="raio-x-botoes">
          <Botao onClick={() => { setApresentando(false); ir(indice - 1) }} aria-label="Etapa anterior">◀</Botao>
          <Botao onClick={() => { setApresentando(false); ir(indice + 1) }} aria-label="Próxima etapa">▶</Botao>
          <Botao variante={apresentando ? 'primario' : 'secundario'} aria-pressed={apresentando} onClick={() => setApresentando((a) => !a)}>
            {apresentando ? '❚❚ Pausar' : '▶ Apresentação'}
          </Botao>
        </div>
        <div className="raio-x-legenda" aria-live="polite">
          <h3>
            {indice + 1}. {atual.titulo} <span>· {atual.conceito}</span>
          </h3>
          <p>{atual.legenda}</p>
        </div>
      </div>
    </div>
  )
}
