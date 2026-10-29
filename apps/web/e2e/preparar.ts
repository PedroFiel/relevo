/** Antes de tudo: o banco de teste precisa estar na última migração (o pytest cria a base). */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { urlBancoTeste } from './ambiente.ts'

export default function preparar() {
  try {
    execFileSync('uv', ['run', 'alembic', 'upgrade', 'head'], {
      cwd: resolve(import.meta.dirname, '../../api'),
      env: { ...process.env, DATABASE_URL: urlBancoTeste() },
      stdio: 'pipe',
    })
  } catch (e) {
    const saida = String((e as { stderr?: Buffer }).stderr ?? e)
    throw new Error(
      `Não deu para preparar o banco de teste (relevo_test). Rode \`make test-py\` uma vez para criá-lo.\n${saida.slice(-800)}`,
    )
  }
}
