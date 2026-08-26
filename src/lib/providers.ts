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
}

export const PROVIDERS: UnofficialProvider[] = [
  {
    id: 'instagram_web',
    nome: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    cookieDomain: 'instagram.com',
    cookieDeSessao: ['sessionid'],
  },
  {
    id: 'facebook_web',
    nome: 'Facebook',
    loginUrl: 'https://www.facebook.com/login',
    cookieDomain: 'facebook.com',
    cookieDeSessao: ['c_user', 'xs'],
  },
  {
    id: 'tiktok_web',
    nome: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    cookieDomain: 'tiktok.com',
    cookieDeSessao: ['sessionid', 'sid_tt'],
  },
]

export function findProvider(id: ProviderId): UnofficialProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

// Claude/Codex aparecem na UI (produto-15 secao 8) mas nao tem adapter --
// mecanismo de credencial e OAuth token via code exchange, nao cookie de
// sessao web. Listados aqui separado, sempre desabilitados.
export const PROVIDERS_EM_BREVE = [
  { id: 'claude', nome: 'Claude' },
  { id: 'codex', nome: 'Codex' },
]
