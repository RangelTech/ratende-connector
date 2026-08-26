// produto-15 secao 2/7e -- sessao da extensao, sempre chrome.storage.local
// (nunca .sync, evita sincronizar credencial pela conta Google do usuario
// entre maquinas sem controle nosso).

export interface SessaoExtensao {
  token: string
  chatwootSsoUrl: string | null
  publicBaseUrl: string
  tenantName: string
}

const CHAVE = 'ratende_connector_sessao'

export async function salvarSessao(sessao: SessaoExtensao): Promise<void> {
  await chrome.storage.local.set({ [CHAVE]: sessao })
}

export async function lerSessao(): Promise<SessaoExtensao | null> {
  const resultado = await chrome.storage.local.get(CHAVE)
  return (resultado[CHAVE] as SessaoExtensao | undefined) ?? null
}

export async function limparSessao(): Promise<void> {
  await chrome.storage.local.remove(CHAVE)
}
