import type { SessaoExtensao } from '../../lib/storage'

/* produto-15 secao 3/4 -- menu principal, layout inspirado no Okta Browser
   Plugin: header com logo+nome do tenant+engrenagem, lista de itens. */
export function MenuView({
  sessao,
  onAbrirNaoOficiais,
  onAbrirConfig,
}: {
  sessao: SessaoExtensao
  onAbrirNaoOficiais: () => void
  onAbrirConfig: () => void
}) {
  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--brand)',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {sessao.tenantName || 'RAtende Connector'}
          </span>
        </div>
        <button
          aria-label="Configurações"
          onClick={onAbrirConfig}
          style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-muted)' }}
        >
          ⚙
        </button>
      </header>

      <div style={{ padding: 8 }}>
        <MenuItem
          label="Abrir RAtende"
          onClick={() => {
            if (sessao.chatwootSsoUrl) window.open(sessao.chatwootSsoUrl, '_blank')
          }}
          disabled={!sessao.chatwootSsoUrl}
        />
        <MenuItem label="Abrir RAgentes" onClick={() => window.open(sessao.publicBaseUrl, '_blank')} />
        <MenuItem label="Logins não oficiais" onClick={onAbrirNaoOficiais} chevron />
      </div>
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  chevron = false,
  disabled = false,
}: {
  label: string
  onClick: () => void
  chevron?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 8px',
        background: 'none',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        color: disabled ? 'var(--text-faint)' : 'var(--text)',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--surface-soft)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
      }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--text-faint)' }}>{chevron ? '›' : '↗'}</span>
    </button>
  )
}
