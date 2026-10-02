import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AbasEstudio from '../components/AbasEstudio'
import ListaAvisos from '../components/ListaAvisos'
import VisorFoto from '../components/VisorFoto'
import { AMOSTRAS, pastaDaAmostra } from '../lib/amostras'
import { ROTULOS, ajustesParaJson, type AjusteFoto, type Metricas, type Vista } from '../lib/vistas'

const REAIS = AMOSTRAS.filter((a) => a.id.startsWith('tenis-'))
const SEM_AJUSTE: AjusteFoto = { rotacao_graus: 0, recorte: null }

type Geracao = { estado: 'ocioso' | 'gerando' | 'ok' | 'erro'; mensagem?: string }

/**
 * Fotos de um tênis — a ENTRADA do pipeline — com o contorno rastreado (F3-T14) e o editor de
 * recorte/rotação (F3-T13). "Aplicar e gerar o 3D" manda os ajustes para a API de
 * desenvolvimento, que roda o pipeline de novo e republica o modelo (sem a API, dá para baixar
 * o ajustes.json e rodar `make real`).
 */
export default function Fotos() {
  const [tenis, setTenis] = useState(REAIS[REAIS.length - 1].id)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [erro, setErro] = useState(false)
  const [ajustes, setAjustes] = useState<Partial<Record<Vista, AjusteFoto>>>({})
  const [editando, setEditando] = useState<Vista | null>(null)
  const [ferramenta, setFerramenta] = useState<'mover' | 'recortar'>('recortar')
  const [camadas, setCamadas] = useState({ contorno: true, mascara: false, didatico: false })
  const [versao, setVersao] = useState(0) // muda depois de regerar: busca as métricas de novo
  const [geracao, setGeracao] = useState<Geracao>({ estado: 'ocioso' })

  useEffect(() => {
    let ativo = true
    fetch(`${pastaDaAmostra(tenis)}/metricas.json?v=${versao}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Metricas) => {
        if (!ativo) return
        setMetricas(m)
        // O editor começa com os ajustes que geraram o modelo atual
        setAjustes(
          Object.fromEntries(
            Object.entries(m.ajustes ?? {}).map(([v, a]) => [v, { rotacao_graus: a.rotacao_graus, recorte: a.recorte }]),
          ),
        )
      })
      .catch(() => ativo && setErro(true))
    return () => {
      ativo = false
    }
  }, [tenis, versao])

  function escolherTenis(id: string) {
    if (id === tenis) return
    setMetricas(null)
    setErro(false)
    setEditando(null)
    setGeracao({ estado: 'ocioso' })
    setTenis(id)
  }

  async function aplicar() {
    setGeracao({ estado: 'gerando' })
    try {
      const r = await fetch(`/api/amostras/${tenis}/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ajustes: JSON.parse(json) }),
      })
      const corpo = await r.json().catch(() => null)
      if (!r.ok) {
        const msg = corpo?.detail
        setGeracao({
          estado: 'erro',
          mensagem:
            typeof msg === 'string'
              ? msg
              : 'A API não respondeu. Rode `make api` em outro terminal (ou baixe o ajustes.json e rode `make real`).',
        })
        return
      }
      setEditando(null)
      setGeracao({ estado: 'ok' })
      setVersao(typeof corpo?.versao === 'number' ? corpo.versao : versao + 1)
    } catch {
      setGeracao({
        estado: 'erro',
        mensagem: 'A API não está rodando. Rode `make api` em outro terminal (ou baixe o ajustes.json e rode `make real`).',
      })
    }
  }

  const json = ajustesParaJson(ajustes)
  const mudou = metricas !== null && json !== ajustesParaJson(Object.fromEntries(
    Object.entries(metricas.ajustes ?? {}).map(([v, a]) => [v, { rotacao_graus: a.rotacao_graus, recorte: a.recorte }]),
  ))

  function baixar() {
    const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'ajustes.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const girar = (v: Vista, delta: number) =>
    setAjustes((s) => {
      const atual = s[v] ?? SEM_AJUSTE
      // Girar muda o sistema de coordenadas da foto exibida: o recorte antigo deixa de valer
      return { ...s, [v]: { rotacao_graus: (((atual.rotacao_graus + delta) % 360) + 360) % 360, recorte: null } }
    })

  return (
    <main className="container largo">
      <p><Link to="/">← Início</Link></p>
      <AbasEstudio />
      <p className="conceito">
        Estas são as fotos que <strong>entram</strong> no pipeline. O contorno laranja é a borda que a segmentação
        achou; tudo que está dentro dele vira silhueta e esculpe o 3D. Se a foto tiver algo a mais (o par do tênis,
        uma caixa) ou vier girada, <strong>ajuste aqui</strong>: 1) clique em <em>Ajustar</em> na foto; 2) arraste um
        retângulo em volta de UM tênis e/ou gire; 3) <em>Aplicar e gerar o 3D</em>.
      </p>

      <div className="toolbar" role="group" aria-label="Tênis">
        {REAIS.map((a) => (
          <button key={a.id} aria-pressed={tenis === a.id} onClick={() => escolherTenis(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="toolbar" role="group" aria-label="Camadas">
        <label><input type="checkbox" checked={camadas.contorno} onChange={(e) => setCamadas({ ...camadas, contorno: e.target.checked })} /> Contorno</label>
        <label><input type="checkbox" checked={camadas.mascara} onChange={(e) => setCamadas({ ...camadas, mascara: e.target.checked })} /> Máscara</label>
        <label><input type="checkbox" checked={camadas.didatico} onChange={(e) => setCamadas({ ...camadas, didatico: e.target.checked })} /> Mostrar janela de recorte</label>
      </div>

      {erro && (
        <p role="alert">
          Não achamos as fotos desse tênis. Rode <code>make reais</code> (gera os modelos e publica as fotos e os
          contornos) e recarregue a página.
        </p>
      )}

      {metricas && (
        <>
          <ListaAvisos avisos={metricas.avisos} />
          <table className="metricas-tabela" style={{ marginBottom: 12 }}>
            <tbody>
              <tr><th>Dimensões</th><td>{metricas.dimensoes_cm.join(' × ')} cm (C × A × L)</td></tr>
              <tr><th>Malha</th><td>{metricas.faces.toLocaleString('pt-BR')} faces · {metricas.fechada ? 'fechada' : 'ABERTA'}</td></tr>
              <tr>
                <th>Concordância (IoU)</th>
                <td>
                  {Object.entries(metricas.consistencia)
                    .filter(([k]) => k.startsWith('iou_'))
                    .map(([k, v]) => `${ROTULOS[k.slice(4) as Vista] ?? k} ${v.toFixed(2)}`)
                    .join(' · ')}
                </td>
              </tr>
              {metricas.secao?.usada && (
                <tr><th>Seção transversal</th><td>arredondou {metricas.secao.volume_removido_pct}% do volume do visual hull</td></tr>
              )}
            </tbody>
          </table>

          <div className="grade-fotos">
            {metricas.vistas.map((v) => {
              const emEdicao = editando === v
              const ajuste = ajustes[v] ?? SEM_AJUSTE
              return (
                <section key={`${tenis}-${v}`} className="foto-card" aria-label={ROTULOS[v]}>
                  <h3>
                    <span>{ROTULOS[v]}</span>
                    <button onClick={() => setEditando(emEdicao ? null : v)}>{emEdicao ? 'Concluir' : 'Ajustar'}</button>
                  </h3>
                  {emEdicao && (
                    <div className="toolbar" role="group" aria-label="Edição da foto">
                      <button onClick={() => girar(v, -90)} aria-label="Girar 90° anti-horário">↺ 90°</button>
                      <button onClick={() => girar(v, 90)} aria-label="Girar 90° horário">↻ 90°</button>
                      <button aria-pressed={ferramenta === 'recortar'} onClick={() => setFerramenta('recortar')}>Recortar</button>
                      <button aria-pressed={ferramenta === 'mover'} onClick={() => setFerramenta('mover')}>Mover</button>
                      <button onClick={() => setAjustes({ ...ajustes, [v]: SEM_AJUSTE })}>Restaurar</button>
                    </div>
                  )}
                  <VisorFoto
                    src={`${pastaDaAmostra(tenis)}/fotos/${v}.jpg`}
                    rotulo={`Foto ${ROTULOS[v]}`}
                    contorno={metricas.contornos[v]?.pontos}
                    mostrarContorno={camadas.contorno && !emEdicao}
                    mostrarMascara={camadas.mascara && !emEdicao}
                    didatico={camadas.didatico && !emEdicao}
                    edicao={
                      emEdicao
                        ? { ajuste, ferramenta, aoMudar: (a) => setAjustes((s) => ({ ...s, [v]: a })) }
                        : undefined
                    }
                  />
                  <p className="conceito">
                    {ajuste.rotacao_graus ? `Girada ${ajuste.rotacao_graus}° (horário). ` : ''}
                    {ajuste.recorte ? `Recorte ${ajuste.recorte[2]} × ${ajuste.recorte[3]} px. ` : ''}
                    {metricas.contornos[v] && `Contorno: ${metricas.contornos[v].pontos.length} vértices, perímetro ${Math.round(metricas.contornos[v].perimetro_px)} px.`}
                  </p>
                </section>
              )
            })}
          </div>

          <section className="painel" style={{ marginTop: 12 }} aria-label="Ajustes">
            <h2>ajustes.json {mudou && <span style={{ color: 'var(--accent)' }}>· alterado</span>}</h2>
            <pre className="matriz">{json}</pre>
            <div className="toolbar">
              <button className="primario" onClick={aplicar} disabled={geracao.estado === 'gerando'}>
                {geracao.estado === 'gerando' ? 'Gerando o 3D…' : 'Aplicar e gerar o 3D'}
              </button>
              <button onClick={baixar}>Baixar ajustes.json</button>
            </div>
            {geracao.estado === 'ok' && (
              <p role="status">
                Modelo regerado com os ajustes. <Link to={`/visualizador?modelo=${tenis}&v=${versao}`}>Ver no 3D →</Link>
              </p>
            )}
            {geracao.estado === 'erro' && <p role="alert" style={{ color: 'var(--accent)' }}>{geracao.mensagem}</p>}
            <p className="conceito">
              <strong>Aplicar e gerar o 3D</strong> grava este arquivo em <code>samples/reais/{tenis}/ajustes.json</code> e roda o
              pipeline de novo (precisa da API: <code>make api</code>). Sem a API: baixe o arquivo, salve nesse lugar e rode{' '}
              <code>make real TENIS={tenis}</code>. O recorte é em pixels da foto já girada; o pipeline guarda a matriz 3×3 que leva
              cada ponto de volta à foto original — é com ela que o contorno cai certinho sobre a foto que você enviou.
            </p>
          </section>
        </>
      )}
    </main>
  )
}
