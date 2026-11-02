import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Botao, Painel } from '../components/ui'
import { useRegistrar } from '../lib/consultas'

/** Página de cadastro com 10 créditos iniciais de boas-vindas (F4-T01). */
export default function Cadastrar() {
  const navegar = useNavigate()
  const registrar = useRegistrar()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    registrar.mutate(
      { nome, email, senha },
      {
        onSuccess: () => navegar('/conta'),
      },
    )
  }

  return (
    <main className="container pagina-simples">
      <div className="detalhe-topo">
        <div>
          <h1>Criar conta no RELEVO</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>
            Sua conta começa automaticamente com <strong>10 créditos</strong> de boas-vindas.
          </p>
        </div>
      </div>

      <Painel>
        <form onSubmit={enviar} className="formulario-auth">
          <label className="campo largo">
            Nome
            <input
              type="text"
              required
              minLength={2}
              autoComplete="name"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
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
            Senha (pelo menos 6 caracteres)
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          {registrar.isError && (
            <p role="alert" className="erro-envio">
              {registrar.error.message}
            </p>
          )}
          <div className="acoes" style={{ marginTop: 12 }}>
            <Botao type="submit" variante="primario" disabled={registrar.isPending}>
              {registrar.isPending ? 'Criando conta…' : 'Criar conta'}
            </Botao>
            <Botao para="/entrar" variante="fantasma">
              Já tenho conta
            </Botao>
          </div>
        </form>
        <p className="conceito" style={{ marginTop: 16, marginBottom: 0 }}>
          Ao criar sua conta, seus modelos ficam isolados no seu usuário (<Link to="/conta">ver conta</Link>).
        </p>
      </Painel>
    </main>
  )
}
