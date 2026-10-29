import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFalso } from '../testes/auxiliares'
import { ErroApi, apagarModelo, buscarJob, buscarModelo, criarModelo, formularioModelo, listarModelos, urlApi } from './api'

const foto = (nome: string) => new File([new Uint8Array([0xff, 0xd8, 0xff])], nome, { type: 'image/jpeg' })

describe('cliente da API (F3-T07)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('monta as URLs com o prefixo /api', async () => {
    const f = fetchFalso({ '': { corpo: {} } })
    await buscarJob('j1')
    await listarModelos()
    await buscarModelo('m1')
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/api/jobs/j1', '/api/modelos', '/api/modelos/m1'])
    expect(urlApi('/arquivos/a1/download')).toBe('/api/arquivos/a1/download')
    expect(urlApi('/api/imagens/i1')).toBe('/api/imagens/i1')
  })

  it('erro 400 vira ErroApi com a mensagem do back', async () => {
    fetchFalso({ 'POST /api/modelos': { status: 400, corpo: { detail: 'A foto lateral não é JPEG nem PNG.' } } })
    const erro = await criarModelo({ nome: 'x', comprimento_cm: 28, fotos: {}, ajustes: {} }).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroApi)
    expect(erro).toMatchObject({ status: 400, mensagem: 'A foto lateral não é JPEG nem PNG.' })
  })

  it('422 do FastAPI (lista de campos) vira uma frase', async () => {
    fetchFalso({ '': { status: 422, corpo: { detail: [{ loc: ['body', 'topo'] }, { loc: ['body', 'nome'] }] } } })
    await expect(listarModelos()).rejects.toThrow('Confira estes campos: topo, nome.')
  })

  it('servidor fora do ar vira mensagem simples (status 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(listarModelos()).rejects.toMatchObject({ status: 0, mensagem: expect.stringContaining('servidor') })
  })

  it('DELETE responde 204 sem corpo', async () => {
    const f = fetchFalso({ 'DELETE /api/modelos/m1': { status: 204 } })
    await expect(apagarModelo('m1')).resolves.toBeUndefined()
    expect(f.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('o formulário leva só as fotos escolhidas e só os ajustes que mudam algo', () => {
    const f = formularioModelo({
      nome: '  Tênis azul ',
      comprimento_cm: 28.5,
      fotos: { lateral: foto('l.jpg'), topo: foto('t.jpg') },
      ajustes: {
        lateral: { rotacao_graus: 0, recorte: null },
        topo: { rotacao_graus: 90, recorte: [1, 2, 300, 200] },
        frente: { rotacao_graus: 180, recorte: null }, // sem foto: não vai
      },
    })
    expect(f.get('nome')).toBe('Tênis azul')
    expect(f.get('comprimento_cm')).toBe('28.5')
    expect(f.get('resolucao')).toBeNull()
    expect(f.get('lateral')).toBeInstanceOf(File)
    expect(f.get('frente')).toBeNull()
    expect(JSON.parse(f.get('ajustes') as string)).toEqual({ topo: { rotacao_graus: 90, recorte: [1, 2, 300, 200] } })
  })
})
