import { useEffect, useState } from 'react'
import { lerLogs, limparLogs, type LogEntry } from '../../lib/logger'

// produto-15 -- tela de debug (pedido do dono 26/08/2026), só usada em
// modo desenvolvimento pra investigar a captura de cookie sem devtools
// aberto o tempo todo. Logs nunca saem da máquina; só copiar/colar aqui.
export function LogsView({ onVoltar }: { onVoltar: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copiado, setCopiado] = useState(false)

  async function recarregar() {
    setLogs((await lerLogs()).slice().reverse())
  }

  useEffect(() => {
    recarregar()
  }, [])

  const texto = JSON.stringify(logs.slice().reverse(), null, 2)

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 1500)
  }

  async function limpar() {
    await limparLogs()
    await recarregar()
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-muted)' }}>
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Logs (debug)</span>
      </header>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copiar} style={btnStyle}>
            {copiado ? 'Copiado!' : 'Copiar tudo'}
          </button>
          <button onClick={recarregar} style={btnStyle}>
            Atualizar
          </button>
          <button onClick={limpar} style={{ ...btnStyle, color: 'var(--danger)' }}>
            Limpar
          </button>
        </div>

        {logs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nenhum log ainda.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((entrada, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: 6,
                  borderRadius: 6,
                  background: entrada.nivel === 'erro' ? 'var(--danger-soft, #fee2e2)' : 'var(--surface-soft)',
                  color: entrada.nivel === 'erro' ? 'var(--danger)' : 'var(--text-muted)',
                  wordBreak: 'break-all',
                }}
              >
                <div>{entrada.ts.slice(11, 19)} · {entrada.msg}</div>
                {entrada.dados !== undefined && (
                  <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(entrada.dados)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const btnStyle = {
  fontSize: 12,
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'none',
} as const
