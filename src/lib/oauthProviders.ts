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
    // 26/08/2026: pagina de CALLBACK (onde o usuario ve o codigo depois
    // de consentir) e' platform.claude.com de verdade, confirmado ao
    // vivo. O endpoint de TOKEN e' outro host -- 2 tentativas erradas
    // antes desta (platform.claude.com, depois console.anthropic.com,
    // baseadas em pesquisa de terceiros) deram 429 "rate_limit_error"
    // (formato de erro da API normal da Anthropic, nao invalid_grant de
    // OAuth -- sinal de estar caindo no rate-limiter generico de /v1/*,
    // nao num endpoint de token de verdade). Valor certo confirmado
    // lendo o codigo-fonte real do 9Router (open-sse/providers/registry/
    // claude.js), que o dono confirma que capturava credencial Claude
    // de verdade em producao -- mesmo client_id/scopes que ja tinhamos,
    // so o tokenUrl que estava errado.
    tokenUrl: 'https://api.anthropic.com/v1/oauth/token',
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
