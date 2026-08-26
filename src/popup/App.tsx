import { useEffect, useState } from 'react'
import type { SessaoExtensao } from '../lib/storage'
import { lerSessao, limparSessao } from '../lib/storage'
import { LoginView } from './views/LoginView'
import { UnofficialLoginsView } from './views/UnofficialLoginsView'
import { PerfilView } from './views/PerfilView'
import { LinksView } from './views/LinksView'
import { SettingsView } from './views/SettingsView'
import { LogsView } from './views/LogsView'
import { Shell, type AbaShell } from './Shell'

type Tela = 'shell' | 'config' | 'logs'

// 26/08/2026 -- quando esta pagina abre como aba de status (ver
// src/background/statusTab.ts) em vez de popup, vem com ?flow=cookie|oauth
// e ?provider=id -- pula direto pra aba Logins com o overlay certo.
const params = new URLSearchParams(window.location.search)
const flowParam = params.get('flow')
const providerParam = params.get('provider')
const aberturaInicial: { flow: 'cookie' | 'oauth'; provider: string } | undefined =
  flowParam === 'cookie' && providerParam
    ? { flow: 'cookie', provider: providerParam }
    : flowParam === 'oauth' && providerParam
      ? { flow: 'oauth', provider: providerParam }
      : undefined

export function App() {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState<SessaoExtensao | null>(null)
  const [tela, setTela] = useState<Tela>('shell')

  useEffect(() => {
    lerSessao().then((s) => {
      setSessao(s)
      setCarregando(false)
    })
  }, [])

  if (carregando) return null

  if (!sessao) {
    return <LoginView onEntrar={setSessao} />
  }

  async function sair() {
    await limparSessao()
    setSessao(null)
    setTela('shell')
  }

  if (tela === 'config') {
    return <SettingsView onVoltar={() => setTela('shell')} onSair={sair} onAbrirLogs={() => setTela('logs')} />
  }
  if (tela === 'logs') {
    return <LogsView onVoltar={() => setTela('config')} />
  }

  return (
    <Shell sessao={sessao} abaInicial={aberturaInicial ? 'logins' : 'perfil'} onAbrirConfig={() => setTela('config')}>
      {(aba: AbaShell) => {
        if (aba === 'perfil') return <PerfilView sessao={sessao} onSair={sair} />
        if (aba === 'links') return <LinksView sessao={sessao} />
        return <UnofficialLoginsView sessao={sessao} aberturaInicial={aberturaInicial} />
      }}
    </Shell>
  )
}
