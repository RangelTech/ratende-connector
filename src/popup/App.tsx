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
    <Shell sessao={sessao} onAbrirConfig={() => setTela('config')}>
      {(aba: AbaShell) => {
        if (aba === 'perfil') return <PerfilView sessao={sessao} onSair={sair} />
        if (aba === 'links') return <LinksView sessao={sessao} />
        return <UnofficialLoginsView sessao={sessao} />
      }}
    </Shell>
  )
}
