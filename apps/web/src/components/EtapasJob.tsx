import type { Job } from '../lib/api'
import { estadoDasEtapas } from '../lib/upload'

const MARCA = { feita: '✓', atual: '●', pendente: '○', falhou: '✕' } as const
const LEITURA = { feita: 'concluída', atual: 'em andamento', pendente: 'pendente', falhou: 'falhou' } as const

/** Andamento do processamento (F3-T09): cada etapa do pipeline + barra de progresso. */
export default function EtapasJob({ job }: { job: Job }) {
  const etapas = estadoDasEtapas(job.etapas, job.etapa_atual, job.status)
  return (
    <div className="etapas-job">
      <div className="barra" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progresso}>
        <div className="barra-preenchida" style={{ width: `${job.progresso}%` }} />
      </div>
      <p className="conceito" aria-live="polite">
        {job.status === 'pendente' ? 'Na fila…' : `${job.progresso}%`}
      </p>
      <ol className="etapas">
        {etapas.map((e) => (
          <li key={e.id} className={`etapa etapa-${e.estado}`}>
            <span className="etapa-marca" aria-hidden="true">{MARCA[e.estado]}</span>
            {e.rotulo}
            <span className="sr-only"> — {LEITURA[e.estado]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
