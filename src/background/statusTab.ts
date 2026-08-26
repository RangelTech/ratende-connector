// produto-15 -- 26/08/2026, pedido do dono (versao final): agora que a
// captura salva sozinha (sem precisar de confirmacao manual), NAO precisa
// de aba de status nenhuma. Fechar a aba de login apos o sucesso fazia o
// Chrome focar automaticamente a aba vizinha (a de status), que "pulava"
// pra frente do nada -- exatamente o "quebrando" que o dono reportou. So
// dispara a captura (abre a aba de login, foca ela) e pronto -- se o
// usuario quiser conferir depois, clica no icone da extensao ele mesmo.

import { iniciarCapturaCookie } from './cookieFlow'
import { iniciarOAuth } from './oauthFlow'
import type { ProviderId } from '../lib/providers'
import type { OAuthProviderId } from '../lib/oauthProviders'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'abrir_status_tab') return false
  ;(message.flow === 'cookie'
    ? iniciarCapturaCookie(message.provider as ProviderId)
    : iniciarOAuth(message.provider as OAuthProviderId)
  )
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' }))
  return true
})
