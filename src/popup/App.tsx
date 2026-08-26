import { useEffect, useState } from 'react'
import type { SessaoExtensao } from '../lib/storage'
import { lerSessao, limparSessao } from '../lib/storage'
import { LoginView } from './views/LoginView'
import { MenuView } from './views/MenuView'
import { UnofficialLoginsView } from './views/UnofficialLoginsView'
import { SettingsView } from './views/SettingsView'
import { LogsView } from './views/LogsView'

type Tela = 'menu' | 'nao-oficiais' | 'config' | 'logs'

// 26/08/2026 -- quando esta pagina abre como aba de status (ver
// src/background/statusTab.ts) em vez de popup, vem com ?flow=cookie|oauth
// e ?provider=id -- pula direto pro modal certo, sem passar pelo menu.
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
  const [tela, setTela] = useState<Tela>(aberturaInicial ? 'nao-oficiais' : 'menu')

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
    setTela('menu')
  }

  if (tela === 'nao-oficiais') {
    return (
      <UnofficialLoginsView
        sessao={sessao}
        onVoltar={() => setTela('menu')}
        aberturaInicial={aberturaInicial}
      />
    )
  }
  if (tela === 'config') {
    return <SettingsView onVoltar={() => setTela('menu')} onSair={sair} onAbrirLogs={() => setTela('logs')} />
  }
  if (tela === 'logs') {
    return <LogsView onVoltar={() => setTela('config')} />
  }
  return (
    <MenuView
      sessao={sessao}
      onAbrirNaoOficiais={() => setTela('nao-oficiais')}
      onAbrirConfig={() => setTela('config')}
    />
  )
}
