import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

// produto-15 (mega-spec-reestrutura) -- extensao RAtende Connector.
// Minimo privilegio: host_permissions cobre so os 3 providers de prova
// (Instagram/Facebook/TikTok) + o backend do agent-platform. Nao pede
// <all_urls>.
export default defineManifest({
  manifest_version: 3,
  name: 'RAtende Connector',
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
  permissions: ['cookies', 'storage', 'tabs'],
  host_permissions: [
    'https://www.instagram.com/*',
    'https://www.facebook.com/*',
    'https://www.tiktok.com/*',
    // TODO: trocar pelo dominio real do agent-platform quando for buildar
    // pra homolog/producao (dev usa localhost via vite).
    'https://ia.rangeltech.net/*',
    'http://localhost:8090/*',
  ],
  externally_connectable: {
    matches: ['https://ia.rangeltech.net/*', 'https://chat.rangeltech.net/*'],
  },
})
