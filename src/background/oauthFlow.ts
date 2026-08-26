// produto-15 -- captura OAuth (Codex/Claude Code) direto na extensao, sem
// app local nenhum (decisao do dono 26/08/2026). Roda no service worker
// (unico lugar com chrome.webNavigation e state persistente entre a aba de
// autorizacao e o retorno).

import { findOAuthProvider, redirectUriDoProvider, type OAuthProvider, type OAuthProviderId } from '../lib/oauthProviders'
import { gerarCodeChallenge, gerarCodeVerifier, gerarState } from '../lib/pkce'
import { log, logErro } from '../lib/logger'

interface PendenteOAuth {
  provider: OAuthProviderId
  state: string
  codeVerifier: string
  redirectUri: string
  tabId?: number
}

const CHAVE_PENDENTE = 'ratende_connector_oauth_pendente'

async function salvarPendente(p: PendenteOAuth): Promise<void> {
  await chrome.storage.session.set({ [CHAVE_PENDENTE]: p })
}

async function lerPendente(): Promise<PendenteOAuth | null> {
  const r = await chrome.storage.session.get(CHAVE_PENDENTE)
  return (r[CHAVE_PENDENTE] as PendenteOAuth | undefined) ?? null
}

async function limparPendente(): Promise<void> {
  await chrome.storage.session.remove(CHAVE_PENDENTE)
}

export async function iniciarOAuth(providerId: OAuthProviderId): Promise<void> {
  const provider = findOAuthProvider(providerId)
  if (!provider) throw new Error(`provider oauth desconhecido: ${providerId}`)

  const codeVerifier = gerarCodeVerifier()
  const codeChallenge = await gerarCodeChallenge(codeVerifier)
  const state = gerarState()
  const redirectUri = redirectUriDoProvider(provider)

  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: provider.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    ...(provider.extraParams ?? {}),
  })

  const tab = await chrome.tabs.create({ url: `${provider.authorizeUrl}?${params.toString()}` })
  await salvarPendente({ provider: providerId, state, codeVerifier, redirectUri, tabId: tab.id })
  await log('oauth iniciado', { provider: providerId })
}

async function trocarCodigoPorToken(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<unknown> {
  const resp = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      code_verifier: codeVerifier,
    }),
  })
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '')
    throw new Error(`troca de token falhou (${resp.status}): ${texto.slice(0, 200)}`)
  }
  return resp.json()
}

async function concluirOAuth(providerId: OAuthProviderId, code: string, state: string): Promise<void> {
  const pendente = await lerPendente()
  if (!pendente || pendente.provider !== providerId) {
    await logErro('oauth concluido sem pendente correspondente', { providerId })
    return
  }
  if (pendente.state !== state) {
    await logErro('oauth state nao bate -- ignorando (possivel CSRF)', { providerId })
    await limparPendente()
    return
  }
  const provider = findOAuthProvider(providerId)
  if (!provider) return

  const chaveResultado = `ratende_connector_oauth_resultado_${providerId}`
  try {
    const tokens = await trocarCodigoPorToken(provider, code, pendente.codeVerifier, pendente.redirectUri)
    await chrome.storage.local.set({
      [chaveResultado]: { ok: true, tokens, obtidoEm: new Date().toISOString() },
    })
    await log('oauth concluido com sucesso', { provider: providerId })
  } catch (err) {
    await logErro('falha na troca de token oauth', err)
    await chrome.storage.local.set({
      [chaveResultado]: { ok: false, erro: err instanceof Error ? err.message : 'falha desconhecida' },
    })
  } finally {
    if (pendente.tabId) chrome.tabs.update(pendente.tabId, { url: 'about:blank' }).catch(() => {})
    await limparPendente()
  }
}

// Codex: o CLI tenta abrir um servidor local de verdade em localhost:1455
// (fallback :1457). A extensao intercepta a TENTATIVA de navegacao antes da
// rede tentar conectar -- o Chrome entrega a URL completa (com o codigo)
// nesse evento mesmo que nada esteja escutando a porta.
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return
  let url: URL
  try {
    url = new URL(details.url)
  } catch {
    return
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return

  const provider = findOAuthProvider('codex_cli')
  if (!provider || provider.captura !== 'localhost') return
  if (!provider.redirectPortas.includes(Number(url.port)) || url.pathname !== provider.redirectPath) return

  const pendente = await lerPendente()
  if (!pendente || pendente.provider !== 'codex_cli') return

  const erro = url.searchParams.get('error')
  if (erro) {
    await logErro('codex oauth retornou erro', { erro })
    await limparPendente()
    return
  }
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return
  await concluirOAuth('codex_cli', code, state)
})

// Claude Code: nao usa localhost -- o content script na pagina hospedada da
// Anthropic (platform.claude.com/oauth/code/callback) manda o codigo por
// mensagem (ver src/content/claudeOAuthCallback.ts).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'claude_oauth_code') {
    if (!sender.tab?.url?.startsWith('https://platform.claude.com/oauth/code/callback')) return false
    concluirOAuth('claude_code', message.code, message.state).then(() => sendResponse({ ok: true }))
    return true
  }
  if (message?.type === 'iniciar_oauth_request') {
    iniciarOAuth(message.provider)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' }))
    return true
  }
  return false
})

export async function lerResultadoOAuth(
  providerId: OAuthProviderId,
): Promise<{ ok: true; tokens: unknown; obtidoEm: string } | { ok: false; erro: string } | undefined> {
  const chave = `ratende_connector_oauth_resultado_${providerId}`
  const r = await chrome.storage.local.get(chave)
  return r[chave]
}

export async function limparResultadoOAuth(providerId: OAuthProviderId): Promise<void> {
  await chrome.storage.local.remove(`ratende_connector_oauth_resultado_${providerId}`)
}
