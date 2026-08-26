// produto-15 -- captura de cookie de sessao rodando no background, nao no
// popup (26/08/2026, bug real achado em teste ao vivo: o popup do Chrome
// fecha sozinho assim que a aba de login abre e perde foco -- todo o
// polling que vivia dentro do componente React morria junto, por isso
// NADA era salvo mesmo com o usuario ja logado). chrome.cookies.onChanged
// e' 100% orientado a evento (sem setInterval), sobrevive ao popup fechado
// e a suspensao do service worker.
//
// 26/08/2026 (2a rodada, pedido do dono): manda pro backend sozinho assim
// que detecta, sem esperar o usuario clicar "Conectar" -- o background ja
// tem acesso a sessao (chrome.storage.local, mesmo lugar que o popup usa)
// e a API, nao precisa do popup vivo pra nada.

import { findProvider, type ProviderId } from '../lib/providers'
import { log, logErro } from '../lib/logger'
import { lerSessao } from '../lib/storage'
import { criarConexao } from '../lib/api'

interface PendenteCookie {
  provider: ProviderId
  tabId?: number
}

const CHAVE_PENDENTE = 'ratende_connector_cookie_pendente'

async function salvarPendente(p: PendenteCookie): Promise<void> {
  await chrome.storage.session.set({ [CHAVE_PENDENTE]: p })
}

async function lerPendente(): Promise<PendenteCookie | null> {
  const r = await chrome.storage.session.get(CHAVE_PENDENTE)
  return (r[CHAVE_PENDENTE] as PendenteCookie | undefined) ?? null
}

async function limparPendente(): Promise<void> {
  await chrome.storage.session.remove(CHAVE_PENDENTE)
}

async function conferirAgora(providerId: ProviderId): Promise<void> {
  const provider = findProvider(providerId)
  if (!provider) return
  let cookies: chrome.cookies.Cookie[]
  try {
    cookies = await chrome.cookies.getAll({ domain: provider.cookieDomain })
  } catch (err) {
    await logErro('chrome.cookies.getAll falhou', { provider: providerId, err })
    return
  }
  const encontrados = provider.cookieDeSessao.every((nome) => cookies.some((c) => c.name === nome))
  // Loga toda tentativa, nao só sucesso -- senão silêncio vira "não sei se
  // rodou" quando algo não bate (achado real 26/08/2026: primeiro teste do
  // dono não achou cookie nenhum e não tinha como saber por quê).
  await log('conferindo cookies', {
    provider: providerId,
    dominioFiltro: provider.cookieDomain,
    esperados: provider.cookieDeSessao,
    achados: cookies.map((c) => `${c.name}@${c.domain}`),
    encontrados,
  })
  if (!encontrados) return

  const pendente = await lerPendente()
  const detectados = cookies
    .filter((c) => provider.cookieDeSessao.includes(c.name))
    .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }))
  await log('sessao detectada (cookie)', { provider: providerId, cookies: detectados.map((c) => c.name) })
  await limparPendente()

  const chaveResultado = `ratende_connector_cookie_resultado_${providerId}`
  const sessao = await lerSessao()
  if (!sessao) {
    await logErro('sessao detectada mas sem login no RAtende -- nao deu pra salvar', { provider: providerId })
    await chrome.storage.local.set({ [chaveResultado]: { ok: false, erro: 'Sem login no RAtende' } })
    return
  }
  try {
    await criarConexao(sessao.token, {
      provider: providerId,
      label: `${provider.nome} ${new Date().toLocaleString('pt-BR')}`,
      cookies: detectados,
    })
    await log('conexao salva automaticamente', { provider: providerId })
    await chrome.storage.local.set({ [chaveResultado]: { ok: true } })
    if (pendente?.tabId) chrome.tabs.remove(pendente.tabId).catch(() => {})
  } catch (err) {
    await logErro('falha ao salvar conexao automaticamente', err)
    await chrome.storage.local.set({
      [chaveResultado]: { ok: false, erro: err instanceof Error ? err.message : 'falha ao salvar' },
    })
  }
}

export async function iniciarCapturaCookie(providerId: ProviderId): Promise<void> {
  const provider = findProvider(providerId)
  if (!provider) throw new Error(`provider desconhecido: ${providerId}`)
  const tab = await chrome.tabs.create({ url: provider.loginUrl })
  await salvarPendente({ provider: providerId, tabId: tab.id })
  await log('captura cookie iniciada', { provider: providerId })
  // Confere na hora -- usuario pode ja estar logado (cookie ja existe antes
  // de qualquer onChanged dessa sessao disparar).
  await conferirAgora(providerId)
}

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.removed) return
  lerPendente().then((pendente) => {
    if (!pendente) return
    conferirAgora(pendente.provider)
  })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'iniciar_captura_cookie_request') return false
  iniciarCapturaCookie(message.provider)
    .then(() => sendResponse({ ok: true }))
    .catch(async (err) => {
      await logErro('iniciarCapturaCookie falhou', err)
      sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' })
    })
  return true
})
