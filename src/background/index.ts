// produto-15 secao 7d/§11.8 -- service worker minimo.
//
// 28/08/2026 (correcao-01-execucao-completa.md secao 2): canal
// externally_connectable (ia.rangeltech.net/chat.rangeltech.net) ganha acao
// de verdade -- ate aqui so respondia "ping". A tela unificada de conexoes
// do agent-platform (frontend) manda `iniciar_conexao` com o provider que o
// usuario clicou; a extensao abre a aba de login/autorizacao igual ja fazia
// pro clique "+" do popup (mesma funcao, so troca quem chama). O resultado
// da captura continua chegando pro backend sozinho (cookieFlow.ts/
// oauthFlow.ts ja salvam automaticamente) -- o site so precisa consultar a
// propria API dele (GET /api/unofficial-connections) pra saber quando a
// conta apareceu, nao precisa de resposta sincrona daqui com o resultado
// final.

import { log, logErro } from '../lib/logger'
import './oauthFlow'
import './cookieFlow'
import './statusTab'
import { iniciarCapturaCookie } from './cookieFlow'
import { iniciarOAuth } from './oauthFlow'
import { findProvider, type ProviderId } from '../lib/providers'
import { findOAuthProvider, type OAuthProviderId } from '../lib/oauthProviders'

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ping') {
    log('ping externo recebido', { origem: sender.origin })
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
    return true
  }

  if (message?.type === 'iniciar_conexao') {
    const provider = message.provider
    log('iniciar_conexao externo recebido', { origem: sender.origin, provider })
    const alvo = findProvider(provider as ProviderId)
      ? iniciarCapturaCookie(provider as ProviderId)
      : findOAuthProvider(provider as OAuthProviderId)
        ? iniciarOAuth(provider as OAuthProviderId)
        : null
    if (!alvo) {
      sendResponse({ ok: false, erro: `provider desconhecido: ${provider}` })
      return true
    }
    alvo
      .then(() => sendResponse({ ok: true }))
      .catch(async (err) => {
        await logErro('iniciar_conexao externo falhou', { provider, err })
        sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' })
      })
    return true
  }

  return false
})

chrome.runtime.onInstalled.addListener((details) => {
  log('extensao instalada/atualizada', { reason: details.reason, versao: chrome.runtime.getManifest().version })
})

export {}
