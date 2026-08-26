// produto-15 -- PKCE (RFC 7636) pro login OAuth do Codex/Claude Code direto
// pela extensao, sem app local nenhum (decisao do dono 26/08/2026: nada de
// instalar coisa extra na maquina do cliente).

function base64UrlEncode(bytes: Uint8Array): string {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function gerarCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return base64UrlEncode(bytes)
}

export async function gerarCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export function gerarState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return base64UrlEncode(bytes)
}
