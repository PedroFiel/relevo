import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { limparToken, salvarToken } from '../lib/api'
import { comProvedores, fetchFalso } from '../testes/auxiliares'
import Conta from './Conta'

const CONTA_INICIAL = {
  id: 'u1',
  nome: 'Usuário Demo',
  email: 'demo@relevo.local',
  creditos: 9,
  movimentos: [
    { id: 'mov2', quantidade: -1, motivo: 'gerar-modelo', job_id: '12345678-aaaa', criado_em: '2026-11-02T12:00:00Z' },
    { id: 'mov1', quantidade: 10, motivo: 'boas-vindas', job_id: null, criado_em: '2026-11-01T10:00:00Z' },
  ],
}

describe('Conta e créditos (F4-T02)', () => {
  afterEach(() => {
    limparToken()
    cleanup()
    vi.unstubAllGlobals()
  })

  it('mostra o saldo de créditos, o histórico e permite recarregar +10 créditos', async () => {
    salvarToken('token-teste')
    const f = fetchFalso({
      'GET /api/me': { corpo: CONTA_INICIAL },
      'POST /api/creditos/recarregar': {
        corpo: {
          ...CONTA_INICIAL,
          creditos: 19,
          movimentos: [
            { id: 'mov3', quantidade: 10, motivo: 'recarga-demo', job_id: null, criado_em: '2026-11-02T12:05:00Z' },
            ...CONTA_INICIAL.movimentos,
          ],
        },
      },
    })
    comProvedores(<Conta />, '/conta')
    expect(await screen.findByLabelText('Saldo de créditos')).toHaveTextContent('9 créditos')
    expect(screen.getByText('Créditos de boas-vindas')).toBeInTheDocument()
    expect(screen.getByText('Geração de modelo 3D')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar 10 créditos' }))
    await waitFor(() => expect(screen.getByLabelText('Saldo de créditos')).toHaveTextContent('19 créditos'))
    expect(f.mock.calls.some((c) => String(c[0]).includes('/creditos/recarregar'))).toBe(true)
  })

  it('mostra opções de entrar e criar conta quando não há usuário logado', async () => {
    limparToken()
    comProvedores(<Conta />, '/conta')
    expect(await screen.findByRole('heading', { level: 1, name: 'Conta e créditos' })).toBeInTheDocument()
    expect(screen.getByText(/Você ainda não está conectado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar na conta' })).toHaveAttribute('href', '/entrar')
    expect(screen.getByRole('link', { name: 'Criar conta (+10 créditos)' })).toHaveAttribute('href', '/cadastrar')
  })
})
