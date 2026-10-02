import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as PE, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AbasEstudio from '../components/AbasEstudio'
import ErroModelo from '../components/ErroModelo'
import ModelViewer from '../components/ModelViewer'
import RenderRaios from '../components/RenderRaios'
import { AMOSTRAS, arquivoValido } from '../lib/amostras'
import { EIXOS, type Vec3 } from '../lib/corte'
import { compor, linhasDaMatriz, type Ordem } from '../lib/matrizes'
import { MODOS, type ModoRender } from '../lib/modosRender'
import {
  TRANSFORMACAO_INICIAL,
  type Caixa,
  type Comando,
  type Corte,
  type Cursor,
  type DadosRaios,
  type InfoCamera,
  type InfoSeparacao,
  type Transformacao,
  type Zoom,
} from '../lib/visualizador'

type Ferramenta = 'ampliar' | 'recortar' | 'separar' | 'transformar' | 'raios'
const FERRAMENTAS: { id: Ferramenta; rotulo: string }[] = [
  { id: 'ampliar', rotulo: 'Ampliar' },
  { id: 'recortar', rotulo: 'Recortar' },
  { id: 'separar', rotulo: 'Selecionar e mover' },
  { id: 'transformar', rotulo: 'Transformar' },
  { id: 'raios', rotulo: 'Rastrear raios' },
]
type ModoGizmo = 'translate' | 'rotate' | 'scale'
const GIZMOS: { id: ModoGizmo; rotulo: string }[] = [
  { id: 'translate', rotulo: 'Mover' },
  { id: 'rotate', rotulo: 'Girar' },
  { id: 'scale', rotulo: 'Aumentar' },
]
const EIXO_IDX = { x: 0, y: 1, z: 2 } as const
const fmt = (v: number) => v.toFixed(1)
// Omit distributivo: tira o id de cada variante da união
type SemId<T> = T extends unknown ? Omit<T, 'id'> : never

function ComoFunciona({ children }: { children: ReactNode }) {
  return (
    <details className="como-funciona" open>
      <summary>Como funciona (CG)</summary>
      {children}
    </details>
  )
}

export default function Visualizador() {
  const [modo, setModo] = useState<ModoRender>('solido')
  // ?modelo=tenis-03&v=123 abre aquele modelo (v força recarregar depois de regerar)
  const [busca] = useSearchParams()
  const [url, setUrl] = useState(() => {
    const a = AMOSTRAS.find((m) => m.id === busca.get('modelo'))
    return a ? `${a.url}${busca.get('v') ? `?v=${busca.get('v')}` : ''}` : AMOSTRAS[0].url
  })
  const [local, setLocal] = useState<{ nome: string; url: string } | null>(null)
  const [erro, setErro] = useState('')
  const atual = MODOS.find((m) => m.id === modo)!

  const [ferramenta, setFerramenta] = useState<Ferramenta>('ampliar')
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [corte, setCorte] = useState<Corte>({ ativo: false, eixo: 'x', posicao: 0, inverter: false, tampa: true })
  const [near, setNear] = useState(0.1)
  const [zoom, setZoom] = useState<Zoom>({ tipo: 'dolly', noPonto: true })
  const [infoCamera, setInfoCamera] = useState<InfoCamera | null>(null)
  const [comando, setComando] = useState<Comando | undefined>()
  const [cursor, setCursor] = useState<Cursor>(null)
  const [gizmo, setGizmo] = useState<{ ativo: boolean; modo: ModoGizmo }>({ ativo: false, modo: 'translate' })
  const [transf, setTransf] = useState<Transformacao>(TRANSFORMACAO_INICIAL)
  const [ordem, setOrdem] = useState<Ordem>('TRS')
  const [raios, setRaios] = useState<DadosRaios | null>(null)
  // Selecionar e mover: desenhando o retângulo? qual gizmo na parte? resultado da separação
  const [desenhando, setDesenhando] = useState(false)
  const [arrasto, setArrasto] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [gizmoParte, setGizmoParte] = useState<'translate' | 'rotate'>('translate')
  const [separacao, setSeparacao] = useState<InfoSeparacao | null>(null)
  const [semSelecao, setSemSelecao] = useState(false)

  // Libera a URL temporária do arquivo local quando ela é trocada ou a página fecha
  useEffect(() => () => { if (local) URL.revokeObjectURL(local.url) }, [local])

  const aoCaixa = useCallback((c: Caixa) => {
    setCaixa(c)
    setCorte((k) => ({ ...k, posicao: (c.min[EIXO_IDX[k.eixo]] + c.max[EIXO_IDX[k.eixo]]) / 2 }))
  }, [])
  const pedir = (c: SemId<Comando>) => {
    ultimoPedido.current = c.tipo
    setComando({ ...c, id: Date.now() } as Comando)
  }

  function trocarModelo(novaUrl: string) {
    setUrl(novaUrl)
    setTransf(TRANSFORMACAO_INICIAL)
    setCursor(null)
    setRaios(null)
    setSeparacao(null)
  }

  // ---- Selecionar e mover: retângulo na tela -> NDC -> comando 'separar' ----
  function iniciarArrasto(e: PE<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setArrasto({ x0: x, y0: y, x1: x, y1: y })
  }
  function moverArrasto(e: PE<HTMLDivElement>) {
    if (!arrasto) return
    const r = e.currentTarget.getBoundingClientRect()
    setArrasto({ ...arrasto, x1: e.clientX - r.left, y1: e.clientY - r.top })
  }
  function soltarArrasto(e: PE<HTMLDivElement>) {
    if (!arrasto) return
    const r = e.currentTarget.getBoundingClientRect()
    setArrasto(null)
    if (Math.abs(arrasto.x1 - arrasto.x0) < 6 || Math.abs(arrasto.y1 - arrasto.y0) < 6) return // só um clique
    // pixels da tela -> coordenadas normalizadas do dispositivo (NDC: −1..1, y para cima)
    const nx = (x: number) => (x / r.width) * 2 - 1
    const ny = (y: number) => 1 - (y / r.height) * 2
    setDesenhando(false)
    setSemSelecao(false)
    pedir({
      tipo: 'separar',
      retangulo: {
        x0: nx(Math.min(arrasto.x0, arrasto.x1)),
        x1: nx(Math.max(arrasto.x0, arrasto.x1)),
        y0: ny(Math.max(arrasto.y0, arrasto.y1)),
        y1: ny(Math.min(arrasto.y0, arrasto.y1)),
      },
    })
  }
  // null depois de 'separar' = o retângulo não pegou nada; depois de 'juntar' é só o fim da separação
  const ultimoPedido = useRef<Comando['tipo'] | null>(null)
  const aoSeparacao = useCallback((s: InfoSeparacao | null) => {
    setSeparacao(s)
    setSemSelecao(s === null && ultimoPedido.current === 'separar')
  }, [])

  function abrirArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return
    if (!arquivoValido(arquivo.name)) {
      setErro('Esse formato não abre aqui. Escolha um arquivo .glb (gerado pelo RELEVO).')
      return
    }
    setErro('')
    const novo = { nome: arquivo.name, url: URL.createObjectURL(arquivo) }
    setLocal(novo)
    trocarModelo(novo.url)
  }

  // Abrir uma ferramenta liga o que ela mostra no modelo (o gizmo só na aba Transformar)
  function escolher(f: Ferramenta) {
    setFerramenta(f)
    setDesenhando(false)
    setGizmo((g) => ({ ...g, ativo: f === 'transformar' }))
    if (f === 'recortar') setCorte((c) => ({ ...c, ativo: true }))
  }

  const limites = caixa ? [caixa.min[EIXO_IDX[corte.eixo]], caixa.max[EIXO_IDX[corte.eixo]]] : [-15, 15]
  const dims: Vec3 | null = caixa ? (caixa.max.map((v, i) => (v - caixa.min[i]) * transf.escala) as Vec3) : null
  const matriz = compor(transf.posicao, transf.rotacao, [transf.escala, transf.escala, transf.escala], ordem)
  const mudarVetor = (chave: 'posicao' | 'rotacao', i: number) => (v: number) =>
    setTransf((t) => ({ ...t, [chave]: t[chave].map((x, j) => (j === i ? v : x)) as Vec3 }))
  const campo = (rotulo: string, valor: number, aoMudar: (v: number) => void, passo = 0.5) => (
    <label key={rotulo} className="campo">
      {rotulo}
      <input type="number" step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value) || 0)} />
    </label>
  )

  const leituraCursor = cursor
    ? `x ${fmt(cursor.modelo[0])} · y ${fmt(cursor.modelo[1])} · z ${fmt(cursor.modelo[2])} cm`
    : 'passe o mouse sobre o modelo'

  return (
    <main className="container largo">
      <p><Link to="/">← Início</Link></p>
      <AbasEstudio />

      <div className="toolbar" role="group" aria-label="Modelo">
        {AMOSTRAS.map((a) => (
          <button key={a.id} aria-pressed={url.split('?')[0] === a.url} onClick={() => trocarModelo(a.url)}>
            {a.rotulo}
          </button>
        ))}
        {local && (
          <button aria-pressed={url === local.url} onClick={() => trocarModelo(local.url)}>
            {local.nome}
          </button>
        )}
        <label className="botao-arquivo">
          Abrir arquivo .glb…
          <input type="file" accept=".glb,.gltf" onChange={abrirArquivo} hidden />
        </label>
      </div>
      {erro && <p role="alert" style={{ color: 'var(--accent)' }}>{erro}</p>}

      <div className="estudio">
        <div>
          <div className="toolbar" role="group" aria-label="Modo de visualização">
            {MODOS.map((m) => (
              <button key={m.id} aria-pressed={m.id === modo} onClick={() => { setModo(m.id); setSeparacao(null) }}>
                {m.rotulo}
              </button>
            ))}
            <span className="conceito" style={{ margin: 0, alignSelf: 'center' }}>{atual.conceito}</span>
          </div>
          <div className="viewer">
            <ErroModelo key={url}>
              <ModelViewer
                url={url}
                modo={modo}
                corte={corte}
                zoom={zoom}
                near={near}
                comando={comando}
                transformar={gizmo}
                transformacao={transf}
                onTransformar={setTransf}
                onCursor={setCursor}
                onCaixa={aoCaixa}
                onCamera={setInfoCamera}
                onCena={setRaios}
                gizmoParte={ferramenta === 'separar' && separacao ? gizmoParte : null}
                onSeparacao={aoSeparacao}
              />
            </ErroModelo>
            {desenhando && (
              <div
                className="camada-selecao"
                onPointerDown={iniciarArrasto}
                onPointerMove={moverArrasto}
                onPointerUp={soltarArrasto}
                aria-label="Arraste para selecionar uma área do modelo"
              >
                {arrasto && (
                  <div
                    className="retangulo-selecao"
                    style={{
                      left: Math.min(arrasto.x0, arrasto.x1),
                      top: Math.min(arrasto.y0, arrasto.y1),
                      width: Math.abs(arrasto.x1 - arrasto.x0),
                      height: Math.abs(arrasto.y1 - arrasto.y0),
                    }}
                  />
                )}
                {!arrasto && <span className="dica-selecao">Arraste um retângulo sobre a parte do tênis</span>}
              </div>
            )}
            {raios && <RenderRaios key={raios.invViewProj.join()} dados={raios} aoFechar={() => setRaios(null)} />}
            <div className="hud" aria-live="polite">
              {infoCamera && `câmera a ${fmt(infoCamera.distancia)} cm · FOV ${fmt(infoCamera.fov)}° · near ${fmt(infoCamera.near)} cm · `}
              cursor: {leituraCursor}
            </div>
          </div>
        </div>

        <aside className="ferramentas" aria-label="Ferramentas de computação gráfica">
          <div className="abas" role="tablist">
            {FERRAMENTAS.map((f) => (
              <button key={f.id} role="tab" aria-selected={ferramenta === f.id} onClick={() => escolher(f.id)}>
                {f.rotulo}
              </button>
            ))}
          </div>

          {ferramenta === 'ampliar' && (
            <section role="tabpanel" aria-label="Ampliar">
              <div className="toolbar">
                <button onClick={() => pedir({ tipo: 'ampliar', fator: 0.7 })}>＋ Ampliar</button>
                <button onClick={() => pedir({ tipo: 'ampliar', fator: 1 / 0.7 })}>－ Reduzir</button>
                <button onClick={() => pedir({ tipo: 'enquadrar' })}>Enquadrar</button>
              </div>
              <div className="toolbar" role="group" aria-label="Tipo de zoom">
                <button aria-pressed={zoom.tipo === 'dolly'} onClick={() => setZoom({ ...zoom, tipo: 'dolly' })}>Aproximar a câmera</button>
                <button aria-pressed={zoom.tipo === 'lente'} onClick={() => setZoom({ ...zoom, tipo: 'lente' })}>Lente (FOV)</button>
              </div>
              <label>
                <input type="checkbox" checked={zoom.noPonto} disabled={zoom.tipo === 'lente'} onChange={(e) => setZoom({ ...zoom, noPonto: e.target.checked })} />{' '}
                Roda do mouse amplia no ponto sob o cursor
              </label>
              <ComoFunciona>
                <p>
                  Ampliar é mudar o que a câmera enxerga. <strong>Aproximar</strong> anda com a câmera (a perspectiva muda:
                  o que está perto cresce mais). <strong>Lente</strong> deixa a câmera parada e fecha o ângulo de visão (FOV) —
                  é como recortar e ampliar a foto. No 2D, o mesmo conceito é encolher a <em>janela</em> do mundo mostrada no visor.
                </p>
                <p>
                  Para ampliar <em>no ponto</em>, um raio sai da câmera pelo pixel do mouse (raycasting) e a câmera anda na direção
                  do ponto atingido: c′ = p + (c − p)·k.
                </p>
              </ComoFunciona>
            </section>
          )}

          {ferramenta === 'recortar' && (
            <section role="tabpanel" aria-label="Recortar">
              <h3>Plano de corte</h3>
              <label>
                <input type="checkbox" checked={corte.ativo} onChange={(e) => setCorte({ ...corte, ativo: e.target.checked })} /> Cortar o modelo
              </label>
              <div className="toolbar" role="group" aria-label="Eixo do corte">
                {EIXOS.map((e) => (
                  <button
                    key={e.id}
                    aria-pressed={corte.eixo === e.id}
                    onClick={() =>
                      setCorte({ ...corte, ativo: true, eixo: e.id, posicao: caixa ? (caixa.min[EIXO_IDX[e.id]] + caixa.max[EIXO_IDX[e.id]]) / 2 : 0 })
                    }
                  >
                    {e.rotulo}
                  </button>
                ))}
              </div>
              <label className="campo largo">
                Posição do plano: {fmt(corte.posicao)} cm
                <input type="range" min={limites[0]} max={limites[1]} step={0.1} value={corte.posicao} onChange={(e) => setCorte({ ...corte, ativo: true, posicao: Number(e.target.value) })} />
              </label>
              <label><input type="checkbox" checked={corte.inverter} onChange={(e) => setCorte({ ...corte, inverter: e.target.checked })} /> Inverter lado</label>{' '}
              <label><input type="checkbox" checked={corte.tampa} onChange={(e) => setCorte({ ...corte, tampa: e.target.checked })} /> Tampa (stencil)</label>

              <h3>Recorte pela câmera (plano near)</h3>
              <label className="campo largo">
                Near: {fmt(near)} cm
                <input type="range" min={0.1} max={infoCamera ? Math.max(1, Math.round(infoCamera.distancia)) : 40} step={0.1} value={near} onChange={(e) => setNear(Number(e.target.value))} />
              </label>
              <ComoFunciona>
                <p>
                  <strong>Recorte (clipping)</strong> é descartar o que fica fora de uma região. A GPU faz isso em todo quadro com o
                  <em> volume de visão</em> (frustum) da câmera: o que está mais perto que o plano <em>near</em> é cortado — arraste o
                  slider “Near” e veja a frente do tênis sumir.
                </p>
                <p>
                  O <strong>plano de corte</strong> (amarelo) é um plano a mais: cada fragmento com <code>n·p + d &lt; 0</code> é
                  descartado. O plano é definido no modelo e levado ao mundo pela mesma matriz do modelo. A tampa laranja vem do
                  <em> stencil buffer</em> e só existe porque a malha é fechada.
                </p>
              </ComoFunciona>
            </section>
          )}

          {ferramenta === 'separar' && (
            <section role="tabpanel" aria-label="Selecionar e mover">
              <div className="toolbar">
                <button className="primario" aria-pressed={desenhando} onClick={() => setDesenhando(!desenhando)}>
                  {desenhando ? 'Cancelar seleção' : separacao ? 'Nova seleção' : 'Selecionar área'}
                </button>
                {separacao && <button onClick={() => pedir({ tipo: 'juntar' })}>Juntar de volta</button>}
              </div>
              {semSelecao && !separacao && !desenhando && (
                <p className="conceito" role="status">O retângulo não pegou nenhuma parte do tênis. Tente de novo em cima do modelo.</p>
              )}
              {separacao && (
                <>
                  <p className="leitura">
                    Parte: {separacao.triangulosParte.toLocaleString('pt-BR')} triângulos · resto:{' '}
                    {separacao.triangulosResto.toLocaleString('pt-BR')} · {separacao.cortados.toLocaleString('pt-BR')} triângulos
                    recortados na borda · {Math.round(separacao.ms)} ms
                  </p>
                  <div className="toolbar" role="group" aria-label="Mexer na parte">
                    <button aria-pressed={gizmoParte === 'translate'} onClick={() => setGizmoParte('translate')}>Mover a parte</button>
                    <button aria-pressed={gizmoParte === 'rotate'} onClick={() => setGizmoParte('rotate')}>Girar a parte</button>
                  </div>
                  <p className="conceito">Arraste as setas que aparecem na parte separada.</p>
                </>
              )}
              <ComoFunciona>
                <p>
                  É a <strong>janela de seleção</strong> dos editores (seleção retangular → recortar → mover), feita no 3D
                  como no Blender (B + P → Separar) e no Meshmixer (Select → Separate).
                </p>
                <p>
                  1) Os 4 lados do retângulo, junto com a câmera, viram <strong>4 planos</strong> — um pedaço do volume de
                  visão. 2) Cada triângulo é testado contra os planos (<code>n·p + d</code>): todo dentro vai para a parte, todo
                  fora fica no resto. 3) Quem cruza a borda é <strong>recortado</strong> com Sutherland–Hodgman em 3D (o mesmo
                  algoritmo do recorte 2D, trocando a borda da janela por um plano); a cor do vértice novo é interpolada.
                  4) A parte vira um objeto com a <strong>sua própria matriz</strong>: mover/girar só ela é transformação num
                  nó filho do grafo de cena.
                </p>
              </ComoFunciona>
            </section>
          )}

          {ferramenta === 'transformar' && (
            <section role="tabpanel" aria-label="Transformar">
              <div className="toolbar" role="group" aria-label="Ferramenta de transformação">
                {GIZMOS.map((g) => (
                  <button key={g.id} aria-pressed={gizmo.modo === g.id} onClick={() => setGizmo({ ativo: true, modo: g.id })}>
                    {g.rotulo}
                  </button>
                ))}
                <button onClick={() => setTransf(TRANSFORMACAO_INICIAL)}>Restaurar</button>
              </div>
              <p className="conceito">Arraste as setas/anéis/cubos no modelo ou digite os valores.</p>
              <div className="campos">
                {(['x', 'y', 'z'] as const).map((e, i) => campo(`Posição ${e} (cm)`, transf.posicao[i], mudarVetor('posicao', i)))}
                {(['x', 'y', 'z'] as const).map((e, i) => campo(`Rotação ${e} (°)`, transf.rotacao[i], mudarVetor('rotacao', i), 5))}
                {campo('Escala (%)', Math.round(transf.escala * 1000) / 10, (v) => setTransf({ ...transf, escala: Math.max(0.1, v / 100) }), 5)}
              </div>
              {dims && <p className="leitura">Dimensões: {fmt(dims[0])} × {fmt(dims[1])} × {fmt(dims[2])} cm (C × A × L)</p>}
              <div className="toolbar" role="group" aria-label="Ordem da composição">
                <button aria-pressed={ordem === 'TRS'} onClick={() => setOrdem('TRS')}>M = T·R·S</button>
                <button aria-pressed={ordem === 'SRT'} onClick={() => setOrdem('SRT')}>M = S·R·T</button>
              </div>
              <pre className="matriz" aria-label="Matriz 4×4">{linhasDaMatriz(matriz).join('\n')}</pre>
              <ComoFunciona>
                <p>
                  Coordenadas homogêneas: o ponto vira (x, y, z, 1) e mover, girar e aumentar viram multiplicação por uma matriz
                  4×4. A matriz da direita age primeiro: em <code>T·R·S</code> o modelo aumenta, gira e depois anda. Troque para
                  <code> S·R·T</code> e veja a translação ser girada e escalada junto.
                  {ordem === 'SRT' && ' (O modelo continua usando T·R·S; esta é só a conta.)'}
                </p>
              </ComoFunciona>
            </section>
          )}

          {ferramenta === 'raios' && (
            <section role="tabpanel" aria-label="Rastrear raios">
              <div className="toolbar">
                <button className="primario" onClick={() => pedir({ tipo: 'raios' })}>Gerar imagem por rastreamento de raios</button>
              </div>
              <p className="leitura">Raio do mouse: {leituraCursor}{cursor && ` · normal (${cursor.normal.map((n) => n.toFixed(2)).join(', ')})`}</p>
              <ComoFunciona>
                <p>
                  O visualizador normal usa <strong>rasterização</strong>: projeta cada triângulo na tela. O
                  <strong> rastreamento de raios</strong> faz o caminho inverso: de cada pixel sai um raio da câmera; o primeiro
                  triângulo atingido dá a cor (Lambert, com a cor das fotos) e dali sai um <em>raio de sombra</em> até a luz — por
                  isso aparece a sombra no chão, que a rasterização daqui não tem.
                </p>
                <p>
                  Para não testar 200 mil triângulos por raio usamos uma <strong>BVH</strong> (árvore de caixas): se o raio não
                  acerta a caixa, nada dentro dela é testado. Interseção raio–triângulo: Möller–Trumbore. O raio do mouse (acima)
                  é o mesmo algoritmo, para um pixel só.
                </p>
              </ComoFunciona>
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}
