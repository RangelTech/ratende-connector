import { useEffect, useState } from 'react'
import type { SessaoExtensao } from '../../lib/storage'
import { buscarPerfil, type Perfil } from '../../lib/api'
import { IconUser } from '../icons'

export function PerfilView({ sessao, onSair }: { sessao: SessaoExtensao; onSair: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    buscarPerfil(sessao.token).then(setPerfil)
  }, [sessao.token])

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 16px' }}>
        Perfil
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-soft)',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--brand-soft)',
            color: 'var(--brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconUser style={{ width: 20, height: 20 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {perfil?.branding.name || perfil?.name || 'Carregando…'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {perfil ? `${perfil.name} · ${perfil.email}` : sessao.tenantName || 'Conectado ao RAgentes'}
          </p>
        </div>
      </div>

      <button
        onClick={onSair}
        style={{
          width: '100%',
          padding: '11px 16px',
          borderRadius: 'var(--radius-input)',
          border: '1px solid var(--border)',
          background: 'var(--surface-elevated)',
          color: 'var(--danger)',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        Sair da conta
      </button>
    </div>
  )
}
