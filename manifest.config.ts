import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

// produto-15 (mega-spec-reestrutura) -- extensao RAtende Connector.
// Minimo privilegio: host_permissions cobre so os 3 providers de prova
// (Instagram/Facebook/TikTok) + o backend do agent-platform. Nao pede
// <all_urls>.
// Chave pública fixa (26/08/2026): trava o ID da extensão pra sempre em
// `ndamceimnbinifibkmegcfhidgjamiaf` -- necessário pro instalador via
// política do Chrome (ExtensionInstallForcelist) apontar sempre pro mesmo
// ID entre builds. Chave privada correspondente NUNCA entra neste repo --
// fica em `personal-skills/secrets/ratende-connector/extension-signing-key.pem`
// (cofre), usada só no momento de empacotar o .crx assinado.
const CHAVE_PUBLICA_FIXA =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0HFpah3CqmGfDuTG9JpOfNXbXhliS7nr+ZFMN3uLaCOn4zars6o05ZTMLx8VQrCfOiYeYI2b+zMH653uoqj0+VgHrPQaIw81sKbeDU5N604pJ5nmBEIs9e5APmxnz2v5R+q8uhD5pPU2hG2w/8iW7ze+FTYSckkezimDoBC7HFqKWFCJRRstn0H/BTStBUeWNoUwJwZk+dkQdxmdwKSqCmpGInOWzmGuTXgTr7uKFFEAmT06AGKNcfE7L6tb2w0MS4eSDFrVgWwTocZzt05Sa2JRp54FYXjso5Nskejbpxsgz37hseall+TF1OgMmcA9qMssek1hKmY6p21ApmBj8QIDAQAB'

export default defineManifest({
  manifest_version: 3,
  name: 'RAtende Connector',
  key: CHAVE_PUBLICA_FIXA,
  version: pkg.version,
  description: 'Conecta contas do RAtende/RAgentes e captura sessoes autorizadas de providers nao oficiais.',
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // webNavigation: unica forma de capturar o redirect OAuth do Codex
  // (localhost:1455/1457) sem subir servidor/app local -- ver
  // src/background/oauthFlow.ts.
  // management: 26/08/2026 -- deteccao de VPN/ad-block que pode interferir
  // (ver src/lib/blockerDetection.ts). NAO era a causa raiz do bug real
  // (ver nota abaixo sobre host_permissions), mas vale manter como
  // seguranca extra -- so avisa, nunca desativa nada sozinha.
  permissions: ['cookies', 'storage', 'tabs', 'webNavigation', 'management'],
  // 26/08/2026, causa raiz real (confirmada lendo o banco de cookies do
  // Chrome direto do disco -- sessionid/c_user/xs SEMPRE existiram, o
  // Windscribe nunca foi o problema): o cookie de sessao do Instagram/
  // Facebook e' salvo com dominio ".instagram.com"/".facebook.com" (sem
  // www, valido pra todos os subdominios) -- mas a permissao so cobria
  // "www.instagram.com". O Chrome checa a permissao da extensao contra o
  // dominio EXATO do cookie pra liberar chrome.cookies, entao "www."
  // sozinho nunca da acesso ao cookie do dominio base. Precisa dos dois
  // padroes (base + wildcard) pra cobrir cookie de qualquer subdominio.
  host_permissions: [
    'https://instagram.com/*',
    'https://*.instagram.com/*',
    'https://facebook.com/*',
    'https://*.facebook.com/*',
    'https://tiktok.com/*',
    'https://*.tiktok.com/*',
    // TODO: trocar pelo dominio real do agent-platform quando for buildar
    // pra homolog/producao (dev usa localhost via vite).
    'https://ia.rangeltech.net/*',
    'http://localhost:8090/*',
    // Codex (OpenAI) -- autorizacao + troca de token.
    'https://auth.openai.com/*',
    // Claude Code (Anthropic) -- autorizacao (claude.ai) + pagina de
    // callback hospedada e troca de token (platform.claude.com --
    // dominio confirmado em teste ao vivo 26/08/2026, rebrand recente;
    // console.anthropic.com mantido por seguranca ate confirmar 100% que
    // nao e' mais usado em nenhuma etapa).
    'https://claude.ai/*',
    'https://platform.claude.com/*',
    'https://console.anthropic.com/*',
    // Codex tenta abrir um servidor local de verdade em localhost:1455/1457
    // -- so precisamos ver a TENTATIVA de navegacao (webNavigation), nao
    // fazer requisicao pra la, mas o host_permissions cobre a garantia de
    // que o evento chega mesmo sem nada escutando a porta.
    'http://localhost/*',
  ],
  content_scripts: [
    {
      matches: ['https://platform.claude.com/oauth/code/callback*'],
      js: ['src/content/claudeOAuthCallback.ts'],
      run_at: 'document_idle',
    },
  ],
  externally_connectable: {
    matches: ['https://ia.rangeltech.net/*', 'https://chat.rangeltech.net/*'],
  },
})
