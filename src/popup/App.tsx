import { useEffect, useState } from 'react'
import type { SessaoExtensao } from '../lib/storage'
import { lerSessao, limparSessao } from '../lib/storage'
import { LoginView } from './views/LoginView'
import { MenuView } from './views/MenuView'
import { UnofficialLoginsView } from './views/UnofficialLoginsView'
import { SettingsView } from './views/SettingsView'

type Tela = 'menu' | 'nao-oficiais' | 'config'

export function App() {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState<SessaoExtensao | null>(null)
  const [tela, setTela] = useState<Tela>('menu')

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
    return <UnofficialLoginsView sessao={sessao} onVoltar={() => setTela('menu')} />
  }
  if (tela === 'config') {
    return <SettingsView onVoltar={() => setTela('menu')} onSair={sair} />
  }
  return (
    <MenuView
      sessao={sessao}
      onAbrirNaoOficiais={() => setTela('nao-oficiais')}
      onAbrirConfig={() => setTela('config')}
    />
  )
}
