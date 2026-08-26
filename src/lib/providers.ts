// produto-15 secao 7c -- registry de providers "nao oficiais" (cookie de
// sessao web). Nomes de cookie de sessao precisam ser confirmados contra
// sessao real antes de considerar isso pronto pra producao (ver spec) --
// os valores abaixo sao o que e publicamente documentado como estavel hoje.

export type ProviderId = 'instagram_web' | 'facebook_web' | 'tiktok_web'

export interface UnofficialProvider {
  id: ProviderId
  nome: string
  loginUrl: string
  cookieDomain: string
  cookieDeSessao: string[]
  // 26/08/2026, pedido do dono: rotulo mostrado na lista precisa
  // identificar a conta (nao a data da captura), e permite deduplicar --
  // reconectar a mesma conta atualiza em vez de duplicar. Cookie cujo
  // valor e' o ID numerico estavel da conta (nao muda entre logins).
  cookieIdExterno: string
}

export const PROVIDERS: UnofficialProvider[] = [
  {
    id: 'instagram_web',
    nome: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    cookieDomain: 'instagram.com',
    cookieDeSessao: ['sessionid'],
    cookieIdExterno: 'ds_user_id',
  },
  {
    id: 'facebook_web',
    nome: 'Facebook',
    loginUrl: 'https://www.facebook.com/login',
    cookieDomain: 'facebook.com',
    cookieDeSessao: ['c_user', 'xs'],
    cookieIdExterno: 'c_user',
  },
  {
    id: 'tiktok_web',
    nome: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    cookieDomain: 'tiktok.com',
    cookieDeSessao: ['sessionid', 'sid_tt'],
    cookieIdExterno: 'uid_tt',
  },
]

export function findProvider(id: ProviderId): UnofficialProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

// Claude Code e Codex tem adapter de verdade agora (26/08/2026) -- ver
// lib/oauthProviders.ts. Mecanismo e' OAuth com PKCE, nao cookie de sessao
// web, por isso vivem numa lista/fluxo separado (UnofficialLoginsView).
