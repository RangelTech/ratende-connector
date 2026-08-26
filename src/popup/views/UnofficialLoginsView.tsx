import { useEffect, useState } from 'react'
import { PROVIDERS, type ProviderId, type UnofficialProvider } from '../../lib/providers'
import { OAUTH_PROVIDERS, findOAuthProvider, type OAuthProviderId } from '../../lib/oauthProviders'
import { criarConexao, criarConexaoOAuth, listarConexoes, type UnofficialConnection, type CookieBundle } from '../../lib/api'
import type { SessaoExtensao } from '../../lib/storage'
import { log, logErro } from '../../lib/logger'

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
  const [oauthAberto, setOauthAberto] = useState<OAuthProviderId | null>(null)

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
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', padding: '8px 8px 0', margin: 0 }}>
        Assinaturas de IA (OAuth)
      </p>
      <div style={{ padding: 8 }}>
        {carregando ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>Carregando…</p>
        ) : (
          OAUTH_PROVIDERS.map((p) => (
            <OAuthProviderRow
              key={p.id}
              nome={p.nome}
              contas={contasDoProvider(p.id)}
              onConectar={() => setOauthAberto(p.id)}
            />
          ))
        )}
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

      {oauthAberto && (
        <CapturaOAuthModal
          providerId={oauthAberto}
          sessao={sessao}
          onFechar={() => setOauthAberto(null)}
          onConectado={() => {
            setOauthAberto(null)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function OAuthProviderRow({
  nome,
  contas,
  onConectar,
}: {
  nome: string
  contas: UnofficialConnection[]
  onConectar: () => void
}) {
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{nome}</span>
        <button
          onClick={onConectar}
          aria-label={`Conectar ${nome}`}
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
    log('captura iniciada', { provider: provider.id, cookieDomain: provider.cookieDomain })
    chrome.tabs.create({ url: provider.loginUrl })

    let tentativas = 0
    const intervalo = window.setInterval(async () => {
      tentativas += 1
      const cookies = await chrome.cookies.getAll({ domain: provider.cookieDomain })
      const encontrados = provider.cookieDeSessao.every((nome) =>
        cookies.some((c) => c.name === nome),
      )
      // Loga só a cada 10 tentativas (20s) pra não inundar o ring buffer
      // enquanto o usuário demora pra fazer login.
      if (tentativas % 10 === 0) {
        log('aguardando cookies de sessao', {
          provider: provider.id,
          tentativas,
          cookiesPresentes: cookies.map((c) => c.name),
        })
      }
      if (encontrados) {
        window.clearInterval(intervalo)
        const detectados = cookies
          .filter((c) => provider.cookieDeSessao.includes(c.name))
          .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }))
        log('sessao detectada', { provider: provider.id, cookies: detectados.map((c) => c.name) })
        setCookiesDetectados(detectados)
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
      log('conexao criada com sucesso', { provider: provider.id })
      onConectado()
    } catch (err) {
      await logErro('falha ao criar conexao', err)
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

type EstadoOAuth = 'aguardando_login' | 'concluido' | 'enviando' | 'erro'

/* produto-15 -- Codex/Claude Code: sem cookie de sessao, o "login" aqui e'
   OAuth com PKCE feito pela propria extensao (ver src/background/oauthFlow.ts).
   O modal so precisa disparar o inicio e ficar de olho no resultado que o
   background grava em chrome.storage.local -- não faz a troca de token
   ela mesma. */
function CapturaOAuthModal({
  providerId,
  sessao,
  onFechar,
  onConectado,
}: {
  providerId: OAuthProviderId
  sessao: SessaoExtensao
  onFechar: () => void
  onConectado: () => void
}) {
  const provider = findOAuthProvider(providerId)!
  const [estado, setEstado] = useState<EstadoOAuth>('aguardando_login')
  const [tokens, setTokens] = useState<unknown>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    log('oauth: pedindo pro background iniciar', { provider: providerId })
    chrome.runtime.sendMessage({ type: 'iniciar_oauth_request', provider: providerId })

    const chave = `ratende_connector_oauth_resultado_${providerId}`
    const intervalo = window.setInterval(async () => {
      const r = await chrome.storage.local.get(chave)
      const resultado = r[chave] as { ok: true; tokens: unknown } | { ok: false; erro: string } | undefined
      if (!resultado) return
      window.clearInterval(intervalo)
      await chrome.storage.local.remove(chave)
      if (resultado.ok) {
        setTokens(resultado.tokens)
        setEstado('concluido')
      } else {
        setErro(resultado.erro)
        setEstado('erro')
      }
    }, 1500)

    return () => window.clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmar() {
    if (!tokens) return
    setEstado('enviando')
    try {
      await criarConexaoOAuth(sessao.token, {
        provider: providerId,
        label: `${provider.nome} principal`,
        oauth_tokens: tokens,
      })
      log('oauth: conexao criada com sucesso', { provider: providerId })
      onConectado()
    } catch (err) {
      await logErro('oauth: falha ao criar conexao', err)
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
            Autorize normalmente na aba que abriu. Volto assim que detectar o retorno.
          </p>
        )}
        {estado === 'concluido' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Autorização concluída. Enviar essa conexão pro RAtende?
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
