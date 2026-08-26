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
import { criarConexao, listarConexoes, removerConexao } from '../lib/api'

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

// 26/08/2026, pedido do dono: le o nome de exibicao direto da pagina
// logada (so texto ja visivel, nunca injeta nada) pra rotular a conta com
// nome de verdade em vez de so o ID numerico -- cookie nenhum dos 3
// providers carrega email/@ em texto puro (confirmado inspecionando os
// valores reais). Facebook: campo "No que voce esta pensando, Nome?" no
// feed. Instagram: link de perfil no menu lateral (ultimo link de
// usuario antes do fim da nav).
async function extrairNomeDaPagina(providerId: ProviderId, tabId: number): Promise<string | null> {
  try {
    if (providerId === 'facebook_web') {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const m = document.body.innerText.match(/pensando,\s*([^?\n]+)\?/)
          return m?.[1]?.trim() ?? null
        },
      })
      return (result as string | null) ?? null
    }
    if (providerId === 'instagram_web') {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const links = [...document.querySelectorAll('nav a[href^="/"]')]
            .map((a) => a.getAttribute('href'))
            .filter((h): h is string => !!h && /^\/[a-zA-Z0-9_.]+\/$/.test(h))
          const ultimo = links[links.length - 1]
          return ultimo ? ultimo.replace(/\//g, '') : null
        },
      })
      return (result as string | null) ?? null
    }
  } catch (err) {
    // Aba pode ja ter sido fechada/navegado antes do script rodar -- nao
    // trava a captura por causa disso, so fica sem o nome bonito.
    await logErro('extrairNomeDaPagina falhou (nao bloqueia a captura)', { provider: providerId, err })
  }
  return null
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
  // ID externo estavel da conta (cookie que nao muda entre logins) -- usado
  // pra rotular a lista (26/08/2026, pedido do dono: mostrar quem é a
  // conta, nao a data da captura) e pra deduplicar (reconectar a mesma
  // conta atualiza em vez de empilhar duplicata).
  const idExterno = cookies.find((c) => c.name === provider.cookieIdExterno)?.value ?? null
  const nomeExtraido = pendente?.tabId ? await extrairNomeDaPagina(providerId, pendente.tabId) : null
  await log('sessao detectada (cookie)', {
    provider: providerId,
    cookies: detectados.map((c) => c.name),
    idExterno,
    nomeExtraido,
  })
  await limparPendente()

  const chaveResultado = `ratende_connector_cookie_resultado_${providerId}`
  const sessao = await lerSessao()
  if (!sessao) {
    await logErro('sessao detectada mas sem login no RAtende -- nao deu pra salvar', { provider: providerId })
    await chrome.storage.local.set({ [chaveResultado]: { ok: false, erro: 'Sem login no RAtende' } })
    return
  }
  try {
    if (idExterno) {
      const existentes = await listarConexoes(sessao.token)
      const duplicada = existentes.find((c) => c.provider === providerId && c.external_label === `#${idExterno}`)
      if (duplicada) {
        await removerConexao(sessao.token, duplicada.id)
        await log('conexao duplicada removida antes de recriar (mesma conta reconectada)', {
          provider: providerId,
          idExterno,
        })
      }
    }
    await criarConexao(sessao.token, {
      provider: providerId,
      label: nomeExtraido ? `${provider.nome} · ${nomeExtraido}` : provider.nome,
      external_label: idExterno ? `#${idExterno}` : undefined,
      cookies: detectados,
    })
    await log('conexao salva automaticamente', { provider: providerId })
    await chrome.storage.local.set({ [chaveResultado]: { ok: true } })
    if (pendente?.tabId) chrome.tabs.remove(pendente.tabId).catch(() => {})
    await chrome.storage.session.remove(`ratende_connector_login_tab_${providerId}`)
  } catch (err) {
    await logErro('falha ao salvar conexao automaticamente', err)
    await chrome.storage.local.set({
      [chaveResultado]: { ok: false, erro: err instanceof Error ? err.message : 'falha ao salvar' },
    })
  }
}

// 26/08/2026, feedback do dono: cada tentativa abria uma aba nova do
// provider sem fechar a anterior -- empilhava Instagram/Facebook/TikTok
// na barra de abas. Reaproveita a mesma aba por provider (guarda o tabId
// na sessao), igual a aba de status.
async function abrirOuFocarAbaLogin(providerId: ProviderId, url: string): Promise<number | undefined> {
  const chave = `ratende_connector_login_tab_${providerId}`
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

export async function iniciarCapturaCookie(providerId: ProviderId): Promise<void> {
  const provider = findProvider(providerId)
  if (!provider) throw new Error(`provider desconhecido: ${providerId}`)
  const tabId = await abrirOuFocarAbaLogin(providerId, provider.loginUrl)
  await salvarPendente({ provider: providerId, tabId })
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
