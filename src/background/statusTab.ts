// produto-15 -- 26/08/2026, pedido do dono: a tela de confirmacao de
// captura nao pode ser o popup (fecha sozinho quando a aba de login ganha
// foco -- limitacao do Chrome, ver oauthFlow.ts/cookieFlow.ts). Vira uma
// aba normal de verdade (nossa propria pagina), SEMPRE reaproveitando a
// mesma aba em vez de empilhar uma nova a cada tentativa.

const CHAVE_TAB = 'ratende_connector_status_tab_id'

async function abrirOuFocarAbaStatus(url: string): Promise<void> {
  const r = await chrome.storage.session.get(CHAVE_TAB)
  const tabId = r[CHAVE_TAB] as number | undefined

  if (tabId) {
    try {
      const aba = await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { url, active: true })
      await chrome.windows.update(aba.windowId, { focused: true })
      return
    } catch {
      // aba foi fechada pelo usuario -- cai pra criar uma nova abaixo
    }
  }

  const nova = await chrome.tabs.create({ url })
  await chrome.storage.session.set({ [CHAVE_TAB]: nova.id })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'abrir_status_tab') return false
  const url = chrome.runtime.getURL(
    `src/popup/index.html?flow=${message.flow}&provider=${message.provider}`,
  )
  abrirOuFocarAbaStatus(url)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, erro: err instanceof Error ? err.message : 'falha' }))
  return true
})
