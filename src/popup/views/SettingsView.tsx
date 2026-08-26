const VERSAO = '0.1.0'

export function SettingsView({ onVoltar, onSair }: { onVoltar: () => void; onSair: () => void }) {
  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-muted)' }}>
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Configurações</span>
      </header>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Versão {VERSAO}</p>
        <button
          onClick={onSair}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'none',
            fontSize: 13,
            color: 'var(--danger)',
            textAlign: 'left',
          }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}
