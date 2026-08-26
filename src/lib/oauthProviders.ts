// produto-15 -- providers OAuth (assinatura de IA), captura direto pela
// extensao, sem app local nenhum. Parametros descobertos 26/08/2026 via
// engenharia reversa (Codex CLI e' open source, confirmado na fonte; Claude
// Code e' fonte fechada, valores cross-checados em 2 reimplementacoes
// independentes -- ver personal-skills/mega-spec-reestrutura/memoria.md).
//
// Os dois usam PKCE (sem client_secret -- client publico, nada sensivel
// embutido na extensao). O que muda e' ONDE o codigo de autorizacao aparece
// depois do consentimento:
// - Codex: o provedor tenta abrir um servidor local de verdade
//   (localhost:1455, com fallback pra :1457) -- a extensao intercepta essa
//   tentativa de navegacao ANTES da rede tentar conectar (nao precisa nada
//   escutando a porta).
// - Claude Code: nao usa localhost -- redireciona pra uma pagina hospedada
//   da propria Anthropic que mostra "codigo#state" pro usuario copiar. A
//   extensao le isso via content script na propria pagina.

export type OAuthProviderId = 'codex_cli' | 'claude_code'

interface OAuthProviderBase {
  id: OAuthProviderId
  nome: string
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  scope: string
  extraParams?: Record<string, string>
}

export interface OAuthProviderLocalhost extends OAuthProviderBase {
  captura: 'localhost'
  redirectPortas: number[]
  redirectPath: string
}

export interface OAuthProviderHospedado extends OAuthProviderBase {
  captura: 'pagina_hospedada'
  redirectUri: string
}

export type OAuthProvider = OAuthProviderLocalhost | OAuthProviderHospedado

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'codex_cli',
    nome: 'Codex (OpenAI)',
    captura: 'localhost',
    authorizeUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
    redirectPortas: [1455, 1457],
    redirectPath: '/auth/callback',
    scope: 'openid profile email offline_access api.connectors.read api.connectors.invoke',
    extraParams: {
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      originator: 'ratende_connector',
    },
  },
  {
    id: 'claude_code',
    nome: 'Claude Code (Anthropic)',
    captura: 'pagina_hospedada',
    authorizeUrl: 'https://claude.ai/oauth/authorize',
    // 26/08/2026, achado em teste ao vivo: a pagina de callback real e'
    // platform.claude.com, nao console.anthropic.com como a pesquisa
    // (reimplementacoes de terceiros) apontava -- rebrand recente da
    // Anthropic. Endpoint de token ainda nao confirmado ao vivo (so a
    // pagina de callback foi observada) -- assumindo mesmo dominio do
    // rebrand, mas isso PRECISA de outro teste real pra confirmar.
    tokenUrl: 'https://platform.claude.com/v1/oauth/token',
    clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    redirectUri: 'https://platform.claude.com/oauth/code/callback',
    scope: 'org:create_api_key user:profile user:inference',
  },
]

export function findOAuthProvider(id: OAuthProviderId): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id)
}

export function redirectUriDoProvider(p: OAuthProvider): string {
  return p.captura === 'pagina_hospedada' ? p.redirectUri : `http://localhost:${p.redirectPortas[0]}${p.redirectPath}`
}
