// produto-15 -- roda dentro de platform.claude.com/oauth/code/callback
// depois do consentimento do Claude Code (dominio confirmado em teste ao
// vivo 26/08/2026 -- rebrand da Anthropic, NAO e' console.anthropic.com
// como pesquisa anterior apontava). Essa pagina e' hospedada pela propria
// Anthropic (nao e' localhost): o `code` vem na query string e o `state`
// no fragmento da URL (confirmado ao vivo:
// ".../callback?code=XXX#YYY") -- a pagina so concatena os dois com "#"
// no campo de copiar/colar pro terminal, por conveniencia do usuario que
// usa o CLI de verdade, mas a extensao le direto da URL.

function extrairCodigoEState(): { code: string; state: string } | null {
  const code = new URLSearchParams(window.location.search).get('code')
  const state = window.location.hash.replace(/^#/, '')
  if (code && state) return { code, state }

  // Fallback: se o formato da pagina mudar de novo, tenta o texto
  // "code#state" visivel no bloco de copiar/colar.
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
