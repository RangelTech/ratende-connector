import type { SessaoExtensao } from '../../lib/storage'
import { IconExternalLink } from '../icons'

function LinkRow({ label, sub, href, disabled }: { label: string; sub: string; href?: string; disabled?: boolean }) {
  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)',
        marginBottom: 10,
        textDecoration: 'none',
        color: disabled ? 'var(--text-faint)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      <IconExternalLink style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
    </a>
  )
}

export function LinksView({ sessao }: { sessao: SessaoExtensao }) {
  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 16px' }}>
        Links
      </p>
      <LinkRow
        label="Abrir RAtende"
        sub="Atendimento (Chatwoot)"
        href={sessao.chatwootSsoUrl ?? undefined}
        disabled={!sessao.chatwootSsoUrl}
      />
      <LinkRow label="Abrir RAgentes" sub="Painel administrativo" href={sessao.publicBaseUrl} />
    </div>
  )
}
