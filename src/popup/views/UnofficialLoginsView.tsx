import { useEffect, useState } from 'react'
import { PROVIDERS, type ProviderId, type UnofficialProvider } from '../../lib/providers'
import { OAUTH_PROVIDERS, findOAuthProvider, type OAuthProvider, type OAuthProviderId } from '../../lib/oauthProviders'
import { listarConexoes, removerConexao, type UnofficialConnection } from '../../lib/api'
import type { SessaoExtensao } from '../../lib/storage'
import { log } from '../../lib/logger'
import { detectarBloqueadores, pausarExtensao, type ExtensaoSuspeita } from '../../lib/blockerDetection'
import { IconCheck, IconChevronDown, IconPlus, IconX } from '../icons'

/* produto-15 -- 26/08/2026, 2a rodada (pedido do dono): lista estilo Okta
   (linha por provider, contador de contas, expandir mostra cada conta com
   opção de remover) + captura agora salva sozinha no backend assim que
   detecta (background faz isso, ver cookieFlow.ts/oauthFlow.ts) -- esta
   view só dispara o início e mostra o resultado, sem botão "Conectar"
   manual. */
export function UnofficialLoginsView({
  sessao,
  aberturaInicial,
}: {
  sessao: SessaoExtensao
  aberturaInicial?: { flow: 'cookie' | 'oauth'; provider: string }
}) {
  const [conexoes, setConexoes] = useState<UnofficialConnection[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [providerAberto, setProviderAberto] = useState<UnofficialProvider | null>(null)
  const [oauthAberto, setOauthAberto] = useState<OAuthProviderId | null>(null)
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
    // 26/08/2026 -- esta tela abriu como aba de status (ver
    // src/background/statusTab.ts): so mostra o overlay de progresso, a
    // captura em si ja foi disparada pelo background antes de abrir a aba.
    if (aberturaInicial?.flow === 'cookie') {
      const provider = PROVIDERS.find((p) => p.id === aberturaInicial.provider)
      if (provider) setProviderAberto(provider)
    } else if (aberturaInicial?.flow === 'oauth') {
      setOauthAberto(aberturaInicial.provider as OAuthProviderId)
    }
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

  function prosseguir(flow: 'cookie' | 'oauth', provider: string) {
    setAvisoBloqueio(null)
    // Dispara a captura de verdade no background (abre a aba do provider +
    // começa a escutar) e, em paralelo, abre/foca a aba de status
    // reaproveitada que vai mostrar o progresso (ver
    // src/background/statusTab.ts e cookieFlow.ts/oauthFlow.ts).
    chrome.runtime.sendMessage({
      type: flow === 'cookie' ? 'iniciar_captura_cookie_request' : 'iniciar_oauth_request',
      provider,
    })
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
              />
            ))}
          </div>
        </>
      )}

      {providerAberto && (
        <CapturaModal
          provider={providerAberto}
          onFechar={() => {
            setProviderAberto(null)
            recarregar()
          }}
        />
      )}

      {oauthAberto && (
        <CapturaOAuthModal
          providerId={oauthAberto}
          onFechar={() => {
            setOauthAberto(null)
            recarregar()
          }}
        />
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
}: {
  nome: string
  contas: UnofficialConnection[]
  expandido: boolean
  onToggle: () => void
  onAdicionar: () => void
  onRemover: (id: string) => void
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
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '9px 14px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.external_label || c.label}
              </span>
              <button
                onClick={() => onRemover(c.id)}
                aria-label="Remover conta"
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', flexShrink: 0, padding: 2 }}
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type EstadoCaptura = 'aguardando' | 'salvo' | 'erro'

/* 26/08/2026 -- popup só dispara e acompanha; a captura de verdade (cookie
   via onChanged, oauth via webNavigation/content script) e o salvamento no
   backend rodam inteiros no background (sobrevive ao popup fechado, ver
   src/background/cookieFlow.ts e oauthFlow.ts). Sem botão "Conectar" --
   salva sozinho assim que detecta. */
function CapturaModal({ provider, onFechar }: { provider: UnofficialProvider; onFechar: () => void }) {
  const [estado, setEstado] = useState<EstadoCaptura>('aguardando')
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    const chave = `ratende_connector_cookie_resultado_${provider.id}`

    const intervalo = window.setInterval(async () => {
      const r = await chrome.storage.local.get(chave)
      const resultado = r[chave] as { ok: true } | { ok: false; erro: string } | undefined
      if (!resultado || cancelado) return
      window.clearInterval(intervalo)
      await chrome.storage.local.remove(chave)
      if (resultado.ok) {
        setEstado('salvo')
        window.setTimeout(() => {
          if (!cancelado) onFechar()
        }, 1100)
      } else {
        setErro(resultado.erro)
        setEstado('erro')
      }
    }, 1200)

    return () => {
      cancelado = true
      window.clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StatusOverlay
      titulo={`Conectar ${provider.nome}`}
      estado={estado}
      erro={erro}
      textoAguardando="Faça login normalmente na aba que abriu. Conecto sozinho assim que detectar a sessão."
      textoSalvo="Conectado!"
      onFechar={onFechar}
    />
  )
}

function CapturaOAuthModal({ providerId, onFechar }: { providerId: OAuthProviderId; onFechar: () => void }) {
  const provider = findOAuthProvider(providerId) as OAuthProvider
  const [estado, setEstado] = useState<EstadoCaptura>('aguardando')
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    const chave = `ratende_connector_oauth_resultado_${providerId}`

    const intervalo = window.setInterval(async () => {
      const r = await chrome.storage.local.get(chave)
      const resultado = r[chave] as { ok: true } | { ok: false; erro: string } | undefined
      if (!resultado || cancelado) return
      window.clearInterval(intervalo)
      await chrome.storage.local.remove(chave)
      if (resultado.ok) {
        setEstado('salvo')
        window.setTimeout(() => {
          if (!cancelado) onFechar()
        }, 1100)
      } else {
        setErro(resultado.erro)
        setEstado('erro')
      }
    }, 1200)

    return () => {
      cancelado = true
      window.clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StatusOverlay
      titulo={`Conectar ${provider.nome}`}
      estado={estado}
      erro={erro}
      textoAguardando="Autorize normalmente na aba que abriu. Conecto sozinho assim que terminar."
      textoSalvo="Conectado!"
      onFechar={onFechar}
    />
  )
}

function StatusOverlay({
  titulo,
  estado,
  erro,
  textoAguardando,
  textoSalvo,
  onFechar,
}: {
  titulo: string
  estado: EstadoCaptura
  erro: string
  textoAguardando: string
  textoSalvo: string
  onFechar: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius-dialog)', padding: 22, width: 260, boxShadow: 'var(--shadow-soft)' }}>
        <h2 style={{ fontSize: 14, margin: '0 0 10px', color: 'var(--text)', fontWeight: 700 }}>{titulo}</h2>

        {estado === 'aguardando' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid var(--brand-soft)',
                borderTopColor: 'var(--brand)',
                animation: 'ratende-spin 800ms linear infinite',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{textoAguardando}</p>
          </div>
        )}
        {estado === 'salvo' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--success-soft)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCheck />
            </span>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 600 }}>{textoSalvo}</p>
          </div>
        )}
        {estado === 'erro' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: '0 0 12px', lineHeight: 1.5 }}>{erro}</p>
            <button
              onClick={onFechar}
              style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: '7px 12px' }}
            >
              Fechar
            </button>
          </>
        )}
      </div>
      <style>{'@keyframes ratende-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
