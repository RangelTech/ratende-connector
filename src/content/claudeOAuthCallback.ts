// produto-15 -- roda dentro de console.anthropic.com/oauth/code/callback
// depois do consentimento do Claude Code. Essa pagina e' hospedada pela
// propria Anthropic (nao e' localhost) e mostra um texto "codigo#state" pro
// usuario copiar manualmente no terminal -- aqui a extensao le isso sozinha
// e manda pro background terminar a troca por token.

function extrairCodigoEState(): { code: string; state: string } | null {
  // Primeiro tenta o fragmento da URL (#code#state ou #code&state=...),
  // que e' onde esse tipo de pagina normalmente coloca o valor.
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.includes('#')) {
    const [code, state] = hash.split('#')
    if (code && state) return { code, state }
  }

  // Se nao veio no hash, procura o texto "code#state" visivel na pagina
  // (formato documentado do fluxo -- um bloco de codigo pra copiar).
  const texto = document.body?.innerText ?? ''
  const match = texto.match(/([A-Za-z0-9_-]{20,})#([A-Za-z0-9_-]{10,})/)
  if (match) return { code: match[1], state: match[2] }

  return null
}

function tentar(): boolean {
  const encontrado = extrairCodigoEState()
  if (!encontrado) return false
  chrome.runtime.sendMessage({ type: 'claude_oauth_code', code: encontrado.code, state: encontrado.state })
  return true
}

if (!tentar()) {
  // A pagina pode renderizar o codigo via JS depois do load -- observa por
  // um tempo curto em vez de assumir que já está pronto no primeiro paint.
  const observador = new MutationObserver(() => {
    if (tentar()) observador.disconnect()
  })
  observador.observe(document.body, { childList: true, subtree: true, characterData: true })
  window.setTimeout(() => observador.disconnect(), 15_000)
}

export {}
