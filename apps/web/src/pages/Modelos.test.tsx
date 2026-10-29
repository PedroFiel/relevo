import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModeloResumo } from '../lib/api'
import { comProvedores, fetchFalso } from '../testes/auxiliares'
import Modelos from './Modelos'

const resumo = (id: string, nome: string, status: ModeloResumo['status']): ModeloResumo => ({
  id, nome, status, versao_atual: status === 'pronto' ? 1 : null, miniatura_url: `/imagens/${id}`, atualizado_em: '2026-10-28T20:00:00Z',
})

describe('Meus modelos (F3-T11)', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lista os cartões com status, miniatura e link', async () => {
    fetchFalso({ 'GET /api/modelos': { corpo: [resumo('m1', 'Tênis azul', 'pronto'), resumo('m2', 'Tênis branco', 'erro')] } })
    comProvedores(<Modelos />, '/modelos')
    expect(await screen.findByText('Tênis azul')).toBeInTheDocument()
    expect(screen.getByText('pronto')).toBeInTheDocument()
    expect(screen.getByText('erro')).toBeInTheDocument()
    expect(screen.getByText('Tênis azul').closest('a')).toHaveAttribute('href', '/modelos/m1')
    expect(document.querySelector('img')).toHaveAttribute('src', '/api/imagens/m1')
  })

  it('sem modelos: convida a criar o primeiro', async () => {
    fetchFalso({ 'GET /api/modelos': { corpo: [] } })
    comProvedores(<Modelos />, '/modelos')
    expect(await screen.findByRole('link', { name: 'Criar o primeiro modelo' })).toHaveAttribute('href', '/novo')
  })

  it('apagar pede confirmação antes do DELETE', async () => {
    const f = fetchFalso({ 'DELETE /api/modelos/m1': { status: 204 }, 'GET /api/modelos': { corpo: [resumo('m1', 'Tênis azul', 'pronto')] } })
    comProvedores(<Modelos />, '/modelos')
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar Tênis azul' }))
    expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar apagar Tênis azul' }))
    await waitFor(() => expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true))
  })

  it('erro de conexão aparece em linguagem simples', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    comProvedores(<Modelos />, '/modelos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos falar com o servidor')
  })
})
