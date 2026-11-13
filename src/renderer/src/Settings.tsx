import { useState } from 'react'
import type { AppConfig } from '../../shared/api'

type Props = {
  config: AppConfig
  onChange: (patch: Partial<AppConfig>) => void
  onConnect: (address: string) => Promise<boolean>
}

export function Settings({ config, onChange, onConnect }: Props) {
  const [name, setName] = useState(config.name)
  const [address, setAddress] = useState(config.manualPeer)
  const [error, setError] = useState('')

  const connect = async () => {
    setError((await onConnect(address)) ? '' : 'IP inválido ou fora da rede local')
  }

  return (
    <section className="settings">
      <label>
        Seu nome
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => onChange({ name })} />
      </label>
      <label>
        IP do par (se a descoberta automática falhar)
        <div className="row">
          <input value={address} placeholder="192.168.0.10" onChange={(e) => setAddress(e.target.value)} />
          <button onClick={() => void connect()}>Conectar</button>
        </div>
        {error && <span className="error">{error}</span>}
      </label>
    </section>
  )
}
