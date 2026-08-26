import { useEffect, useState } from 'react'
import { PROVIDERS, PROVIDERS_EM_BREVE, type ProviderId, type UnofficialProvider } from '../../lib/providers'
import { criarConexao, listarConexoes, type UnofficialConnection, type CookieBundle } from '../../lib/api'
import type { SessaoExtensao } from '../../lib/storage'

/* produto-15 secao 5 -- fluxo de captura. Popup precisa continuar aberto
   durante o polling (limitacao de v1 aceitavel pra POC -- monitorar com o
   popup fechado exigiria mover o polling pro background service worker,
   fica pra uma iteracao futura se a captura provar que funciona). */
export function UnofficialLoginsView({
  sessao,
  onVoltar,
}: {
  sessao: SessaoExtensao
  onVoltar: () => void
}) {
  const [conexoes, setConexoes] = useState<UnofficialConnection[]>([])
  const [carregando, setCarregando] = useState(true)
  const [providerAberto, setProviderAberto] = useState<UnofficialProvider | null>(null)

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

  function contasDoProvider(id: ProviderId) {
    return conexoes.filter((c) => c.provider === id)
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-muted)' }}>
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Logins não oficiais</span>
      </header>

      <div style={{ padding: 8 }}>
        {carregando ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>Carregando…</p>
        ) : (
          PROVIDERS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              contas={contasDoProvider(p.id)}
              onAdicionar={() => setProviderAberto(p)}
            />
          ))
        )}
        {PROVIDERS_EM_BREVE.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 8px',
              fontSize: 13,
              color: 'var(--text-faint)',
            }}
          >
            <span>{p.nome}</span>
            <span>em breve</span>
          </div>
        ))}
      </div>

      {providerAberto && (
        <CapturaModal
          provider={providerAberto}
          sessao={sessao}
          onFechar={() => setProviderAberto(null)}
          onConectado={() => {
            setProviderAberto(null)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function ProviderRow({
  provider,
  contas,
  onAdicionar,
}: {
  provider: UnofficialProvider
  contas: UnofficialConnection[]
  onAdicionar: () => void
}) {
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{provider.nome}</span>
        <button
          onClick={onAdicionar}
          aria-label={`Adicionar conta ${provider.nome}`}
          style={{ background: 'var(--brand-soft)', border: 'none', borderRadius: 6, width: 22, height: 22, color: 'var(--brand)', fontSize: 14 }}
        >
          +
        </button>
      </div>
      {contas.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '2px 0 0' }}>Nenhuma conta conectada</p>
      ) : (
        contas.map((c) => (
          <p key={c.id} style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {c.external_label || c.label}
          </p>
        ))
      )}
    </div>
  )
}

type EstadoCaptura = 'aguardando_login' | 'sessao_detectada' | 'enviando' | 'erro'

function CapturaModal({
  provider,
  sessao,
  onFechar,
  onConectado,
}: {
  provider: UnofficialProvider
  sessao: SessaoExtensao
  onFechar: () => void
  onConectado: () => void
}) {
  const [estado, setEstado] = useState<EstadoCaptura>('aguardando_login')
  const [cookiesDetectados, setCookiesDetectados] = useState<CookieBundle[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    chrome.tabs.create({ url: provider.loginUrl })

    const intervalo = window.setInterval(async () => {
      const cookies = await chrome.cookies.getAll({ domain: provider.cookieDomain })
      const encontrados = provider.cookieDeSessao.every((nome) =>
        cookies.some((c) => c.name === nome),
      )
      if (encontrados) {
        window.clearInterval(intervalo)
        setCookiesDetectados(
          cookies
            .filter((c) => provider.cookieDeSessao.includes(c.name))
            .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path })),
        )
        setEstado('sessao_detectada')
      }
    }, 2000)

    return () => window.clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmar() {
    if (!cookiesDetectados) return
    setEstado('enviando')
    try {
      await criarConexao(sessao.token, {
        provider: provider.id,
        label: `${provider.nome} principal`,
        cookies: cookiesDetectados,
      })
      onConectado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao conectar')
      setEstado('erro')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ background: 'var(--surface-solid)', borderRadius: 12, padding: 16, width: 280 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--text)' }}>Conectar {provider.nome}</h2>

        {estado === 'aguardando_login' && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Faça login normalmente na aba que abriu. Volto assim que detectar a sessão.
          </p>
        )}
        {estado === 'sessao_detectada' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Conta detectada. Enviar essa sessão pro RAtende?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onFechar} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
                Cancelar
              </button>
              <button
                onClick={confirmar}
                style={{ fontSize: 12, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px' }}
              >
                Conectar
              </button>
            </div>
          </>
        )}
        {estado === 'enviando' && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conectando…</p>}
        {estado === 'erro' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--danger)' }}>{erro}</p>
            <button onClick={onFechar} style={{ fontSize: 12, marginTop: 8 }}>
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
