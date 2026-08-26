// produto-15 -- 26/08/2026, pedido do dono: a tela de confirmacao de
// captura nao pode ser o popup (fecha sozinho quando a aba de login ganha
// foco -- limitacao do Chrome, ver oauthFlow.ts/cookieFlow.ts). Vira uma
// aba normal de verdade (nossa propria pagina), SEMPRE reaproveitando a
// mesma aba em vez de empilhar uma nova a cada tentativa.
//
// 2a rodada (mesmo dia, feedback do dono apos teste ao vivo): abrir a aba
// de status E a aba de login em paralelo (duas mensagens separadas)
// deixava o foco numa corrida -- as vezes ficava na aba de status
// (confuso, "ele nem sabe que tem que logar"), e cada tentativa empilhava
// mais uma aba do provider sem fechar a anterior. Esta versao concentra a
// orquestracao aqui: abre/foca a aba de status SEM roubar foco, so DEPOIS
// inicia a captura de verdade (que abre a aba do provider e essa sim fica
// em primeiro plano).

import { iniciarCapturaCookie } from './cookieFlow'
import { iniciarOAuth } from './oauthFlow'
import { log } from '../lib/logger'
import type { ProviderId } from '../lib/providers'
import type { OAuthProviderId } from '../lib/oauthProviders'

const CHAVE_TAB = 'ratende_connector_status_tab_id'

async function abrirOuFocarAbaStatus(url: string): Promise<void> {
  const r = await chrome.storage.session.get(CHAVE_TAB)
  const tabId = r[CHAVE_TAB] as number | undefined

  if (tabId) {
    try {
      await chrome.tabs.get(tabId)
      // active:false -- nao rouba foco da aba de login que vai abrir em
      // seguida (iniciarCapturaCookie/iniciarOAuth cria com active:true).
      await chrome.tabs.update(tabId, { url, active: false })
      return
    } catch {
      // aba foi fechada pelo usuario -- cai pra criar uma nova abaixo
    }
  }

  const nova = await chrome.tabs.create({ url, active: false })
  await chrome.storage.session.set({ [CHAVE_TAB]: nova.id })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'abrir_status_tab') return false
  const url = chrome.runtime.getURL(
    `src/popup/index.html?flow=${message.flow}&provider=${message.provider}`,
  )
  ;(async () => {
    await log('fluxo iniciado', { flow: message.flow, provider: message.provider })
    // Ordem importa: abre/foca a aba de status primeiro (sem foco), so
    // depois dispara a captura de verdade -- assim a aba do provider (que
    // rouba o foco de proposito) fica por cima no final, e o usuario cai
    // direto na tela de login, nao na aba de status.
    await abrirOuFocarAbaStatus(url)
    if (message.flow === 'cookie') await iniciarCapturaCookie(message.provider as ProviderId)
    else await iniciarOAuth(message.provider as OAuthProviderId)
  })()
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' }))
  return true
})
