// produto-15 -- log de debug em modo desenvolvimento (pedido do dono
// 26/08/2026, pra investigar a captura de cookie sem precisar ficar
// olhando o devtools em tempo real). Ring buffer em chrome.storage.local,
// nunca sai da máquina -- puramente pra ler depois via "Ver logs" nas
// Configurações e colar pra debugar.

export type NivelLog = 'info' | 'erro'

export interface LogEntry {
  ts: string
  nivel: NivelLog
  msg: string
  dados?: unknown
}

const CHAVE = 'ratende_connector_logs'
const MAX_ENTRADAS = 200

export async function log(msg: string, dados?: unknown, nivel: NivelLog = 'info'): Promise<void> {
  const entrada: LogEntry = { ts: new Date().toISOString(), nivel, msg, dados }
  const atual = await lerLogs()
  const novo = [...atual, entrada].slice(-MAX_ENTRADAS)
  await chrome.storage.local.set({ [CHAVE]: novo })
}

export async function logErro(msg: string, erro: unknown): Promise<void> {
  const dados = erro instanceof Error ? { nome: erro.name, mensagem: erro.message } : erro
  await log(msg, dados, 'erro')
}

export async function lerLogs(): Promise<LogEntry[]> {
  const resultado = await chrome.storage.local.get(CHAVE)
  return (resultado[CHAVE] as LogEntry[] | undefined) ?? []
}

export async function limparLogs(): Promise<void> {
  await chrome.storage.local.remove(CHAVE)
}
