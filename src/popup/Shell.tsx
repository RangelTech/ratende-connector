import { useState, type ReactNode } from 'react'
import type { SessaoExtensao } from '../lib/storage'
import { IconGear, IconLink, IconShield, IconUser } from './icons'

// produto-15 -- 26/08/2026, pedido do dono: layout inspirado no painel de
// apps do Okta (rail lateral fixo com abas, conteudo troca a direita) em
// vez do menu de lista simples anterior.
export type AbaShell = 'perfil' | 'logins' | 'links'

const ABAS: { id: AbaShell; label: string; Icon: typeof IconUser }[] = [
  { id: 'perfil', label: 'Perfil', Icon: IconUser },
  { id: 'logins', label: 'Logins', Icon: IconShield },
  { id: 'links', label: 'Links', Icon: IconLink },
]

export function Shell({
  sessao,
  abaInicial = 'logins',
  onAbrirConfig,
  children,
}: {
  sessao: SessaoExtensao
  abaInicial?: AbaShell
  onAbrirConfig: () => void
  children: (aba: AbaShell) => ReactNode
}) {
  const [aba, setAba] = useState<AbaShell>(abaInicial)

  return (
    <div style={{ display: 'flex', height: 460 }}>
      <aside
        style={{
          width: 128,
          flexShrink: 0,
          background: 'linear-gradient(180deg, var(--brand-dark), #241a3d)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <img
            src="/logo-rangeltech.png"
            alt="Rangel Tech"
            style={{ width: 40, height: 40, objectFit: 'contain' }}
          />
          <span
            style={{
              marginTop: 10,
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {sessao.tenantName || 'RAtende Connector'}
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {ABAS.map(({ id, label, Icon }) => {
            const ativo = aba === id
            return (
              <button
                key={id}
                onClick={() => setAba(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 12,
                  border: 'none',
                  background: ativo ? 'rgba(255,255,255,0.14)' : 'transparent',
                  color: ativo ? '#fff' : 'rgba(255,255,255,0.62)',
                  fontSize: 12.5,
                  fontWeight: ativo ? 600 : 500,
                  textAlign: 'left',
                  transition: 'background 180ms ease, color 180ms ease',
                }}
              >
                <Icon style={{ flexShrink: 0 }} />
                {label}
              </button>
            )
          })}
        </nav>

        <button
          onClick={onAbrirConfig}
          aria-label="Configurações"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 10px',
            borderRadius: 12,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12.5,
          }}
        >
          <IconGear style={{ flexShrink: 0 }} />
          Config
        </button>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)' }}>
        {children(aba)}
      </main>
    </div>
  )
}
