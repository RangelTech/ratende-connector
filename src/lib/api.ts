// produto-15 -- cliente HTTP pro backend do agent-platform. Mesmo contrato
// de qualquer client externo autenticado (token normal de sessao) -- nao
// tem endpoint especial so pra extensao.

import { log, logErro } from './logger'

// Vite troca `import.meta.env.PROD` em tempo de build (nao runtime) --
// dev server usa o backend local, `vite build` (o que vira o zip
// distribuido, ver produto-15 secao 9) usa o dominio real.
export const BACKEND_URL = import.meta.env.PROD ? 'https://ia.rangeltech.net' : 'http://localhost:8090'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let resp: Response
  try {
    resp = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })
  } catch (err) {
    await logErro(`fetch falhou: ${options.method ?? 'GET'} ${path}`, err)
    throw err
  }
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body.detail ?? detail
    } catch {
      // corpo nao-JSON, mantem statusText
    }
    await logErro(`${options.method ?? 'GET'} ${path} -> ${resp.status}`, detail)
    throw new ApiError(resp.status, detail)
  }
  await log(`${options.method ?? 'GET'} ${path} -> ${resp.status}`)
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

export interface LoginResponse {
  token: string
  chatwoot_sso_url: string | null
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export interface UnofficialConnection {
  id: string
  tenant_id: string
  provider: string
  label: string
  external_label: string | null
  status: string
  updated_at: string
}

export function listarConexoes(token: string): Promise<UnofficialConnection[]> {
  return request<UnofficialConnection[]>('/api/unofficial-connections', {}, token)
}

export interface CookieBundle {
  name: string
  value: string
  domain: string
  path: string
}

export function criarConexao(
  token: string,
  payload: { provider: string; label: string; external_label?: string; cookies: CookieBundle[] },
): Promise<UnofficialConnection> {
  return request<UnofficialConnection>(
    '/api/unofficial-connections',
    { method: 'POST', body: JSON.stringify(payload) },
    token,
  )
}

// produto-15 -- mesma tabela/endpoint dos providers de cookie, mas o
// payload carrega tokens OAuth (Codex/Claude Code) em vez de cookies. Ver
// backend/app/routes/unofficial_connections.py.
export function criarConexaoOAuth(
  token: string,
  payload: { provider: string; label: string; oauth_tokens: unknown },
): Promise<UnofficialConnection> {
  return request<UnofficialConnection>(
    '/api/unofficial-connections',
    { method: 'POST', body: JSON.stringify(payload) },
    token,
  )
}

export function removerConexao(token: string, id: string): Promise<void> {
  return request<void>(`/api/unofficial-connections/${id}`, { method: 'DELETE' }, token)
}
