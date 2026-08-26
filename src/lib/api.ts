// produto-15 -- cliente HTTP pro backend do agent-platform. Mesmo contrato
// de qualquer client externo autenticado (token normal de sessao) -- nao
// tem endpoint especial so pra extensao.

// TODO: trocar pelo dominio real (https://ia.rangeltech.net) no build de
// producao -- dev usa o backend local.
export const BACKEND_URL = 'http://localhost:8090'

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

  const resp = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body.detail ?? detail
    } catch {
      // corpo nao-JSON, mantem statusText
    }
    throw new ApiError(resp.status, detail)
  }
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

export function removerConexao(token: string, id: string): Promise<void> {
  return request<void>(`/api/unofficial-connections/${id}`, { method: 'DELETE' }, token)
}
