import { useState, type CSSProperties, type FormEvent } from 'react'
import { login, ApiError } from '../../lib/api'
import { salvarSessao, type SessaoExtensao } from '../../lib/storage'
import { log } from '../../lib/logger'

/* produto-15 secao 7e -- login direto no RAgentes, sem pairing token
   (decisao do dono 25/08: a extensao ja sabe quem eh o usuario, nao
   precisa da danca de codigo temporario do documento original). */
export function LoginView({ onEntrar }: { onEntrar: (s: SessaoExtensao) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const resultado = await login(email, senha)
      const sessao: SessaoExtensao = {
        token: resultado.token,
        chatwootSsoUrl: resultado.chatwoot_sso_url,
        publicBaseUrl: 'https://ia.rangeltech.net',
        tenantName: '',
      }
      await salvarSessao(sessao)
      log('login concluido', { email })
      onEntrar(sessao)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Falha ao entrar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 16, margin: '0 0 4px', color: 'var(--text)' }}>RAtende Connector</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Entre com sua conta RAgentes.
      </p>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={inputStyle}
        />
        {erro && <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{erro}</p>}
        <button type="submit" disabled={enviando} style={buttonStyle}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13,
}

const buttonStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--brand)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
}
