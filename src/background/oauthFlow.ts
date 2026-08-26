// produto-15 -- captura OAuth (Codex/Claude Code) direto na extensao, sem
// app local nenhum (decisao do dono 26/08/2026). Roda no service worker
// (unico lugar com chrome.webNavigation e state persistente entre a aba de
// autorizacao e o retorno).

import { findOAuthProvider, redirectUriDoProvider, type OAuthProvider, type OAuthProviderId } from '../lib/oauthProviders'
import { gerarCodeChallenge, gerarCodeVerifier, gerarState } from '../lib/pkce'
import { log, logErro } from '../lib/logger'
import { lerSessao } from '../lib/storage'
import { criarConexaoOAuth } from '../lib/api'

// 26/08/2026, pedido do dono: Codex pede escopo "openid profile email" --
// a resposta da troca de token ja vem com um id_token (JWT) contendo
// email/nome direto, sem precisar de chamada extra nem ler pagina nenhuma.
// So decodifica o payload (base64url), sem verificar assinatura -- nao
// precisamos confiar nisso pra autenticacao, so pra rotular a lista.
function decodificarIdToken(idToken: string): { email?: string; name?: string; sub?: string } | null {
  try {
    const payload = idToken.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

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

// 26/08/2026, feedback do dono: cada tentativa abria uma aba nova de
// autorizacao sem fechar a anterior. Reaproveita a mesma aba por provider.
async function abrirOuFocarAbaAutorizacao(providerId: OAuthProviderId, url: string): Promise<number | undefined> {
  const chave = `ratende_connector_oauth_tab_${providerId}`
  const r = await chrome.storage.session.get(chave)
  const tabId = r[chave] as number | undefined
  if (tabId) {
    try {
      await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { url, active: true })
      return tabId
    } catch {
      // aba foi fechada pelo usuario -- cai pra criar uma nova abaixo
    }
  }
  const nova = await chrome.tabs.create({ url })
  await chrome.storage.session.set({ [chave]: nova.id })
  return nova.id
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

  const tabId = await abrirOuFocarAbaAutorizacao(providerId, `${provider.authorizeUrl}?${params.toString()}`)
  await salvarPendente({ provider: providerId, state, codeVerifier, redirectUri, tabId })
  await log('oauth iniciado', { provider: providerId })
}

async function trocarCodigoPorToken(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  state: string,
): Promise<unknown> {
  const resp = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      // 26/08/2026, achado ao vivo: sem `state` no corpo, a Anthropic
      // devolve 400 "Invalid request format" -- nao e' opcional pra ela
      // (mesmo state que ja foi validado contra CSRF antes de chegar
      // aqui). Confirmado no payload real do 9Router
      // (src/lib/oauth/services/claude.js), que manda esse campo. Extra
      // no Codex nao deve quebrar (servidores OAuth ignoram campo nao
      // reconhecido), mantido generico pros dois providers.
      state,
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

// 26/08/2026, achado ao vivo: onCommitted e onHistoryStateUpdated disparam
// quase juntos pra uma navegacao real (nao SPA) -- os dois chamavam
// concluirOAuth com o MESMO code, e como lerPendente() e' async, as duas
// chamadas liam o pendente antes de qualquer uma limpar, disparando 2
// trocas de token concorrentes com o mesmo authorization code. O Anthropic
// via isso como uso duplicado/abusivo do code e devolvia 429 -- login
// direto no site nunca dispara isso (so 1 navegacao, 1 listener). Guarda
// em memoria (sincrona, sem await entre checar e marcar) evita a corrida,
// mesmo principio do `emAndamento` em cookieFlow.ts.
const processandoOAuth = new Set<OAuthProviderId>()

async function concluirOAuth(providerId: OAuthProviderId, code: string, state: string): Promise<void> {
  if (processandoOAuth.has(providerId)) {
    await log('oauth callback duplicado ignorado (troca ja em andamento)', { providerId })
    return
  }
  processandoOAuth.add(providerId)
  try {
    await concluirOAuthSemTrava(providerId, code, state)
  } finally {
    processandoOAuth.delete(providerId)
  }
}

async function concluirOAuthSemTrava(providerId: OAuthProviderId, code: string, state: string): Promise<void> {
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
    const tokens = await trocarCodigoPorToken(provider, code, pendente.codeVerifier, pendente.redirectUri, state)
    await log('oauth concluido com sucesso', { provider: providerId })

    const idTokenClaims =
      tokens && typeof tokens === 'object' && 'id_token' in tokens && typeof (tokens as { id_token: unknown }).id_token === 'string'
        ? decodificarIdToken((tokens as { id_token: string }).id_token)
        : null
    const nomeExtraido = idTokenClaims?.name || idTokenClaims?.email || null
    const idExterno = idTokenClaims?.sub ?? idTokenClaims?.email ?? null
    await log('id_token decodificado', { provider: providerId, nomeExtraido, temSub: !!idTokenClaims?.sub })

    // 26/08/2026, pedido do dono: salva direto no backend, sem esperar
    // clique de confirmar -- background ja tem tudo que precisa (sessao +
    // API), popup nao precisa estar aberto.
    const sessao = await lerSessao()
    if (!sessao) {
      await logErro('oauth concluido mas sem login no RAtende -- nao deu pra salvar', { providerId })
      await chrome.storage.local.set({ [chaveResultado]: { ok: false, erro: 'Sem login no RAtende' } })
    } else {
      // 26/08/2026 -- dedup e' o proprio backend via UPSERT atomico
      // (migration 0039), mesmo motivo do cookieFlow.ts: checagem no
      // codigo (listar -> comparar -> apagar -> criar) nao e' atomica.
      await criarConexaoOAuth(sessao.token, {
        provider: providerId,
        label: nomeExtraido ? `${provider.nome} · ${nomeExtraido}` : provider.nome,
        external_label: idExterno ? `#${idExterno}` : undefined,
        oauth_tokens: tokens,
      })
      await log('oauth: conexao salva automaticamente', { provider: providerId })
      await chrome.storage.local.set({ [chaveResultado]: { ok: true } })
    }
  } catch (err) {
    await logErro('falha na troca de token oauth (ou ao salvar)', err)
    await chrome.storage.local.set({
      [chaveResultado]: { ok: false, erro: err instanceof Error ? err.message : 'falha desconhecida' },
    })
  } finally {
    // 26/08/2026, feedback do dono: deixar a aba de autorizacao em branco
    // (about:blank) parecia bug -- fecha a aba de verdade em vez disso.
    if (pendente.tabId) chrome.tabs.remove(pendente.tabId).catch(() => {})
    await chrome.storage.session.remove(`ratende_connector_oauth_tab_${providerId}`)
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

// Claude Code: nao usa localhost. Duas formas de capturar o retorno --
// 26/08/2026, achado em teste ao vivo: quando o usuario ja tava logado no
// claude.ai, a autorizacao completou via navegacao client-side (SPA,
// pushState) em vez de um reload de pagina de verdade -- o content script
// (que so injeta em navegacao real, ver claudeOAuthCallback.ts) nunca
// rodou, silenciosamente sumindo com a captura. chrome.webNavigation.
// onHistoryStateUpdated cobre navegacao SPA tambem, e o code/state ja vem
// na propria URL (query+hash) -- nao precisa nem ler o texto da pagina.
function extrairDaUrlCallback(url: string): { code: string; state: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!u.href.startsWith('https://platform.claude.com/oauth/code/callback')) return null
  const code = u.searchParams.get('code')
  const state = u.hash.replace(/^#/, '')
  if (code && state) return { code, state }
  return null
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return
  const achado = extrairDaUrlCallback(details.url)
  if (achado) concluirOAuth('claude_code', achado.code, achado.state)
})

// Cobertura pro caso normal tambem (navegacao de verdade, nao SPA) -- nao
// depende do content script terminar de carregar a pagina.
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return
  const achado = extrairDaUrlCallback(details.url)
  if (achado) concluirOAuth('claude_code', achado.code, achado.state)
})

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
): Promise<{ ok: true } | { ok: false; erro: string } | undefined> {
  const chave = `ratende_connector_oauth_resultado_${providerId}`
  const r = await chrome.storage.local.get(chave)
  return r[chave]
}

export async function limparResultadoOAuth(providerId: OAuthProviderId): Promise<void> {
  await chrome.storage.local.remove(`ratende_connector_oauth_resultado_${providerId}`)
}
