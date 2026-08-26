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

async function tentarLerNomeUmaVez(providerId: ProviderId, tabId: number): Promise<string | null> {
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
        // 26/08/2026, achado ao vivo: o link de perfil NAO fica dentro de
        // <nav> (versao anterior restrita a nav nao achava nada). Pega
        // qualquer link de usuario na pagina, mas ignora os paths fixos do
        // proprio Instagram (explore/reels/direct/etc -- confirmado ao
        // vivo que "links[0]" pegava "/reels/" errado) -- o primeiro que
        // sobra depois do filtro e' o link de perfil de verdade.
        const FIXOS = new Set([
          'explore', 'reels', 'direct', 'accounts', 'notifications', 'stories', 'p', 'tv', 'about', 'legal',
        ])
        const links = [...document.querySelectorAll('a[href^="/"]')]
          .map((a) => a.getAttribute('href'))
          .filter((h): h is string => !!h && /^\/[a-zA-Z0-9_.]+\/$/.test(h))
          .filter((h) => !FIXOS.has(h.replace(/\//g, '')))
        return links[0] ? links[0].replace(/\//g, '') : null
      },
    })
    return (result as string | null) ?? null
  }
  if (providerId === 'tiktok_web') {
    // Confirmado ao vivo 26/08/2026: TikTok marca o link de perfil no
    // menu com data-e2e="nav-profile" (atributo de hook de teste deles,
    // mais estavel que classe CSS ofuscada).
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const href = document.querySelector('[data-e2e="nav-profile"]')?.getAttribute('href')
        return href?.startsWith('/@') ? href.slice(2) : null
      },
    })
    return (result as string | null) ?? null
  }
  return null
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 26/08/2026, pedido do dono: le o nome de exibicao direto da pagina
// logada (so texto ja visivel, nunca injeta nada) pra rotular a conta com
// nome de verdade em vez de so o ID numerico -- cookie nenhum dos 3
// providers carrega email/@ em texto puro (confirmado inspecionando os
// valores reais). Facebook: campo "No que voce esta pensando, Nome?" no
// feed. Instagram: link de perfil (primeiro link de usuario na pagina).
// TikTok: data-e2e="nav-profile".
//
// Achado real: quando o provider ja estava logado, a checagem de cookie
// disparava ANTES da pagina (SPA) terminar de renderizar esse texto --
// tentativa unica voltava vazia. Tenta varias vezes com espera curta em
// vez de desistir cedo -- TikTok em particular demorou mais de 5 tentativas
// (~7s) num teste ao vivo, entao 12x800ms (~10s) da mais margem. Roda tudo
// em background depois que o cookie ja foi salvo, entao esperar mais nao
// atrasa nada visivel pro usuario.
async function extrairNomeDaPagina(providerId: ProviderId, tabId: number): Promise<string | null> {
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    try {
      const nome = await tentarLerNomeUmaVez(providerId, tabId)
      if (nome) return nome
    } catch (err) {
      // Aba pode ja ter sido fechada/navegado -- nao trava a captura, so
      // para de tentar.
      await logErro('extrairNomeDaPagina falhou (nao bloqueia a captura)', { provider: providerId, err })
      return null
    }
    await esperar(800)
  }
  return null
}

// 26/08/2026, achado ao vivo: chrome.cookies.onChanged dispara MUITAS
// vezes num site ativo (cada cookie que muda, nao so o de sessao) -- sem
// essa trava, cada evento inicia sua propria leitura de pagina (5
// tentativas x 700ms) em paralelo, desperdicando trabalho (o banco ja
// garante que nao duplica, mas nao ha motivo pra rodar 9 leituras da
// mesma pagina ao mesmo tempo).
const emAndamento = new Set<ProviderId>()

async function conferirAgora(providerId: ProviderId): Promise<void> {
  if (emAndamento.has(providerId)) return
  emAndamento.add(providerId)
  try {
    await conferirAgoraSemTrava(providerId)
  } finally {
    emAndamento.delete(providerId)
  }
}

async function conferirAgoraSemTrava(providerId: ProviderId): Promise<void> {
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
    // 26/08/2026, achado ao vivo: checar duplicata aqui (listar -> comparar
    // -> apagar -> criar) NAO e' atomico -- varias capturas concorrentes
    // (chrome.cookies.onChanged disparando em paralelo pro mesmo provider)
    // passavam pela checagem ao mesmo tempo e criavam N duplicatas numa
    // unica rodada (9 do Instagram, ao vivo). Dedup agora e' o proprio
    // backend via UPSERT atomico (migration 0039 + ON CONFLICT) --
    // reconectar a mesma conta sempre atualiza, garantido pelo banco.
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
