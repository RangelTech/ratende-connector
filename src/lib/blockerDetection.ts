// produto-15 -- detecta extensoes de VPN/ad-block/anti-tracker instaladas
// que podem apagar o cookie de sessao antes da captura ler (achado real
// 26/08/2026: Windscribe apagava sessionid/c_user/xs do Instagram/Facebook
// silenciosamente, TikTok nao era afetado). Heuristica por NOME em vez de
// lista fixa de IDs -- cobre Windscribe, uBlock, AdGuard, Ghostery, Privacy
// Badger etc sem precisar manter uma lista que fica desatualizada.
//
// Nunca desativa nada sozinha -- so detecta e oferece um botao que o
// usuario precisa clicar.

const PALAVRAS_CHAVE = ['vpn', 'block', 'guard', 'privacy', 'shield', 'ghostery', 'proxy', 'tracker']

export interface ExtensaoSuspeita {
  id: string
  nome: string
}

export async function detectarBloqueadores(): Promise<ExtensaoSuspeita[]> {
  const todas = await chrome.management.getAll()
  return todas
    .filter((e) => e.enabled && e.id !== chrome.runtime.id && e.type === 'extension')
    .filter((e) => PALAVRAS_CHAVE.some((k) => e.name.toLowerCase().includes(k)))
    .map((e) => ({ id: e.id, nome: e.name }))
}

export async function pausarExtensao(id: string): Promise<void> {
  await chrome.management.setEnabled(id, false)
}
