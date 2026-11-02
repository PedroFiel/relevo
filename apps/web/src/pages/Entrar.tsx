import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Botao, Painel } from '../components/ui'
import { useLogin } from '../lib/consultas'

/** Página de login com e-mail e senha (F4-T01). */
export default function Entrar() {
  const navegar = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    login.mutate(
      { email, senha },
      {
        onSuccess: () => navegar('/conta'),
      },
    )
  }

  return (
    <main className="container pagina-simples">
      <div className="detalhe-topo">
        <div>
          <h1>Entrar na sua conta</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>
            Acesse seus modelos 3D e seu saldo de créditos.
          </p>
        </div>
      </div>

      <Painel>
        <form onSubmit={enviar} className="formulario-auth">
          <label className="campo largo">
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="campo largo">
            Senha
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          {login.isError && (
            <p role="alert" className="erro-envio">
              {login.error.message}
            </p>
          )}
          <div className="acoes" style={{ marginTop: 12 }}>
            <Botao type="submit" variante="primario" disabled={login.isPending}>
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </Botao>
            <Botao para="/cadastrar" variante="secundario">
              Criar conta (10 créditos grátis)
            </Botao>
          </div>
        </form>
        <p className="conceito" style={{ marginTop: 16, marginBottom: 0 }}>
          Quer apenas testar? Você também pode continuar usando a{' '}
          <Link to="/conta">conta de demonstração</Link> sem precisar de senha.
        </p>
      </Painel>
    </main>
  )
}
