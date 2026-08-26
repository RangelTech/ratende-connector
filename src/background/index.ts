// produto-15 secao 7d/§11.8 -- service worker minimo. Nesta fase (POC) o
// polling de cookie roda no popup (ver UnofficialLoginsView), nao aqui --
// mover pro background pra sobreviver ao popup fechado eh melhoria futura,
// depois de provar que a captura funciona.
//
// Por enquanto o background so responde ao canal externally_connectable
// (ia.rangeltech.net/chat.rangeltech.net) com um ping, provando que o canal
// existe e esta restrito aos dominios certos -- nenhuma acao real ainda.

import { log } from '../lib/logger'
import './oauthFlow'

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ping') {
    log('ping externo recebido', { origem: sender.origin })
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
    return true
  }
  return false
})

chrome.runtime.onInstalled.addListener((details) => {
  log('extensao instalada/atualizada', { reason: details.reason, versao: chrome.runtime.getManifest().version })
})

export {}
