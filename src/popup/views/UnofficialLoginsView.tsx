import { useEffect, useState } from 'react'
import { PROVIDERS, type ProviderId } from '../../lib/providers'
import { OAUTH_PROVIDERS, type OAuthProviderId } from '../../lib/oauthProviders'
import { listarConexoes, removerConexao, renomearConexao, type UnofficialConnection } from '../../lib/api'
import type { SessaoExtensao } from '../../lib/storage'
import { log } from '../../lib/logger'
import { detectarBloqueadores, pausarExtensao, type ExtensaoSuspeita } from '../../lib/blockerDetection'
import { IconChevronDown, IconPlus, IconX } from '../icons'

/* produto-15 -- 26/08/2026, 2a rodada (pedido do dono): lista estilo Okta
   (linha por provider, contador de contas, expandir mostra cada conta com
   opção de remover) + captura agora salva sozinha no backend assim que
   detecta (background faz isso, ver cookieFlow.ts/oauthFlow.ts) -- esta
   view só dispara o início e mostra o resultado, sem botão "Conectar"
   manual. */
export function UnofficialLoginsView({ sessao }: { sessao: SessaoExtensao }) {
  const [conexoes, setConexoes] = useState<UnofficialConnection[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [avisoBloqueio, setAvisoBloqueio] = useState<{
    flow: 'cookie' | 'oauth'
    provider: string
    bloqueadores: ExtensaoSuspeita[]
  } | null>(null)

  async function recarregar() {
    setCarregando(true)
    try {
      setConexoes(await listarConexoes(sessao.token))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function contasDoProvider(id: ProviderId | OAuthProviderId) {
    return conexoes.filter((c) => c.provider === id)
  }

  async function tentarAbrir(flow: 'cookie' | 'oauth', provider: string) {
    const bloqueadores = await detectarBloqueadores()
    if (bloqueadores.length > 0) {
      setAvisoBloqueio({ flow, provider, bloqueadores })
      return
    }
    prosseguir(flow, provider)
  }

  /* 26/08/2026, pedido do dono (versao final): a captura salva sozinha,
     sem confirmacao manual -- entao NAO precisa de aba/tela nenhuma
     depois de clicar "+". So dispara e pronto: abre a aba de login (o
     background cuida disso), e se o usuario quiser conferir se pegou,
     reabre a extensao ele mesmo. Zero aba extra, zero foco roubado. */
  function prosseguir(flow: 'cookie' | 'oauth', provider: string) {
    setAvisoBloqueio(null)
    chrome.runtime.sendMessage({ type: 'abrir_status_tab', flow, provider })
  }

  async function pausarNoAviso(id: string) {
    await pausarExtensao(id)
    log('extensao bloqueadora pausada', { id })
    setAvisoBloqueio((atual) => {
      if (!atual) return atual
      const restantes = atual.bloqueadores.filter((b) => b.id !== id)
      if (restantes.length === 0) {
        prosseguir(atual.flow, atual.provider)
        return null
      }
      return { ...atual, bloqueadores: restantes }
    })
  }

  async function remover(id: string) {
    await removerConexao(sessao.token, id)
    recarregar()
  }

  async function renomear(id: string, label: string) {
    await renomearConexao(sessao.token, id, label)
    recarregar()
  }

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 16px' }}>
        Logins
      </p>

      {avisoBloqueio && (
        <div style={{ background: 'var(--danger-soft)', borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 8px', fontWeight: 600, lineHeight: 1.4 }}>
            Essas extensões estão impedindo o login com esse provedor (elas apagam o cookie de sessão antes de
            conseguirmos ler). Desative temporariamente -- depois que capturar o login, pode ativar de novo:
          </p>
          {avisoBloqueio.bloqueadores.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{b.nome}</span>
              <button
                onClick={() => pausarNoAviso(b.id)}
                style={{ fontSize: 11, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}
              >
                Pausar agora
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={() => setAvisoBloqueio(null)}
              style={{ fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => prosseguir(avisoBloqueio.flow, avisoBloqueio.provider)}
              style={{ fontSize: 11, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 8, padding: '5px 10px' }}
            >
              Continuar mesmo assim
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {PROVIDERS.map((p) => (
              <ProviderCard
                key={p.id}
                nome={p.nome}
                contas={contasDoProvider(p.id)}
                expandido={expandido === p.id}
                onToggle={() => setExpandido((atual) => (atual === p.id ? null : p.id))}
                onAdicionar={() => tentarAbrir('cookie', p.id)}
                onRemover={remover}
                onRenomear={renomear}
              />
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px' }}>
            Assinaturas de IA
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OAUTH_PROVIDERS.map((p) => (
              <ProviderCard
                key={p.id}
                nome={p.nome}
                contas={contasDoProvider(p.id)}
                expandido={expandido === p.id}
                onToggle={() => setExpandido((atual) => (atual === p.id ? null : p.id))}
                onAdicionar={() => tentarAbrir('oauth', p.id)}
                onRemover={remover}
                onRenomear={renomear}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* Linha estilo Okta: nome + badge de contagem + "..." que expande a lista
   de contas conectadas (cada uma com opção de remover). */
function ProviderCard({
  nome,
  contas,
  expandido,
  onToggle,
  onAdicionar,
  onRemover,
  onRenomear,
}: {
  nome: string
  contas: UnofficialConnection[]
  expandido: boolean
  onToggle: () => void
  onAdicionar: () => void
  onRemover: (id: string) => void
  onRenomear: (id: string, label: string) => void
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={contas.length > 0 ? onToggle : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '13px 14px',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          cursor: contas.length > 0 ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{nome}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {contas.length > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--success)',
                background: 'var(--success-soft)',
                borderRadius: 999,
                padding: '2px 9px',
              }}
            >
              {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
            </span>
          )}
          <span
            role="button"
            aria-label={`Adicionar conta`}
            onClick={(e) => {
              e.stopPropagation()
              onAdicionar()
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 9,
              background: 'var(--brand-soft)',
              color: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPlus />
          </span>
          {contas.length > 0 && (
            <IconChevronDown
              style={{
                color: 'var(--text-faint)',
                transform: expandido ? 'rotate(180deg)' : 'none',
                transition: 'transform 200ms ease',
              }}
            />
          )}
        </span>
      </button>

      {contas.length === 0 && (
        <p style={{ margin: 0, padding: '0 14px 12px', fontSize: 11.5, color: 'var(--text-faint)' }}>
          Nenhuma conta conectada
        </p>
      )}

      {expandido && contas.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {contas.map((c) => (
            <ContaRow key={c.id} conta={c} onRemover={onRemover} onRenomear={onRenomear} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContaRow({
  conta,
  onRemover,
  onRenomear,
}: {
  conta: UnofficialConnection
  onRemover: (id: string) => void
  onRenomear: (id: string, label: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(conta.label)

  function salvar() {
    setEditando(false)
    const limpo = valor.trim()
    if (limpo && limpo !== conta.label) onRenomear(conta.id, limpo)
    else setValor(conta.label)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '9px 14px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {editando ? (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') {
              setValor(conta.label)
              setEditando(false)
            }
          }}
          style={{
            fontSize: 12,
            padding: '3px 6px',
            borderRadius: 6,
            border: '1px solid var(--brand)',
            minWidth: 0,
            flex: 1,
          }}
        />
      ) : (
        <button
          onClick={() => setEditando(true)}
          title="Clique pra renomear"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 12,
            color: 'var(--text-muted)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
            flex: 1,
          }}
        >
          {conta.label}
        </button>
      )}
      <button
        onClick={() => onRemover(conta.id)}
        aria-label="Remover conta"
        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', flexShrink: 0, padding: 2 }}
      >
        <IconX />
      </button>
    </div>
  )
}

