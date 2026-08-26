// produto-15 -- captura de cookie de sessao rodando no background, nao no
// popup (26/08/2026, bug real achado em teste ao vivo: o popup do Chrome
// fecha sozinho assim que a aba de login abre e perde foco -- todo o
// polling que vivia dentro do componente React morria junto, por isso
// NADA era salvo mesmo com o usuario ja logado). chrome.cookies.onChanged
// e' 100% orientado a evento (sem setInterval), sobrevive ao popup fechado
// e a suspensao do service worker.

import { findProvider, type ProviderId } from '../lib/providers'
import { log, logErro } from '../lib/logger'

interface PendenteCookie {
  provider: ProviderId
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

  const detectados = cookies
    .filter((c) => provider.cookieDeSessao.includes(c.name))
    .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }))
  await chrome.storage.local.set({
    [`ratende_connector_cookie_resultado_${providerId}`]: { ok: true, cookies: detectados },
  })
  await log('sessao detectada (cookie)', { provider: providerId, cookies: detectados.map((c) => c.name) })
  await limparPendente()
}

export async function iniciarCapturaCookie(providerId: ProviderId): Promise<void> {
  const provider = findProvider(providerId)
  if (!provider) throw new Error(`provider desconhecido: ${providerId}`)
  await chrome.tabs.create({ url: provider.loginUrl })
  await salvarPendente({ provider: providerId })
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
