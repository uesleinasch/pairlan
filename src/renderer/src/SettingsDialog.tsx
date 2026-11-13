import { useEffect, useState, type KeyboardEvent } from 'react'
import type { AppConfig } from '../../shared/api'

type Props = {
  open: boolean
  config: AppConfig
  onClose: () => void
  onChange: (patch: Partial<AppConfig>) => void
  onConnect: (address: string) => Promise<boolean>
}

const valueOf = (e: Event) => (e.target as HTMLInputElement).value
const selectedOf = (e: Event) => (e.target as HTMLElement & { selected: boolean }).selected

const SHORTCUTS: [string, string][] = [
  ['Enter', 'Enviar mensagem'],
  ['Shift+Enter', 'Quebrar linha'],
  ['Ctrl+Espaço (segurar)', 'Falar no walkie-talkie'],
  ['Ctrl+V', 'Colar print ou arquivo'],
  ['Esc', 'Fechar esta janela']
]

export function SettingsDialog({ open, config, onClose, onChange, onConnect }: Props) {
  const [name, setName] = useState(config.name)
  const [address, setAddress] = useState(config.manualPeer)
  const [addressError, setAddressError] = useState('')
  const opacity = Math.round(config.opacity * 100)

  useEffect(() => {
    if (!open) return
    setName(config.name)
    setAddress(config.manualPeer)
    setAddressError('')
  }, [open, config.name, config.manualPeer])

  const connect = async () => {
    const ok = await onConnect(address)
    setAddressError(ok ? '' : 'IP inválido ou fora da rede local. Ex.: 192.168.0.10')
    if (ok) onClose()
  }

  return (
    <md-dialog open={open} onclosed={onClose} className="settings-dialog">
      <span slot="headline">Configurações</span>
      <div slot="content" className="settings-content">
        <section>
          <h2 className="type-title-small">Perfil</h2>
          <md-outlined-text-field
            label="Seu nome"
            value={name}
            maxLength={40}
            oninput={(e: Event) => setName(valueOf(e))}
            onchange={() => onChange({ name })}
          />
        </section>

        <section>
          <h2 className="type-title-small">Conexão</h2>
          <div className="settings-row">
            <md-outlined-text-field
              label="IP do par"
              placeholder="192.168.0.10"
              value={address}
              supportingText="Use se a descoberta automática não achar o par"
              error={Boolean(addressError)}
              errorText={addressError}
              oninput={(e: Event) => setAddress(valueOf(e))}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') void connect()
              }}
            />
            <md-filled-tonal-button onClick={() => void connect()}>Conectar</md-filled-tonal-button>
          </div>
        </section>

        <section>
          <h2 className="type-title-small">Janela</h2>
          <label className="settings-slider">
            <span className="type-body-medium">Opacidade: {opacity}%</span>
            <md-slider
              min={30}
              max={100}
              step={5}
              value={opacity}
              labeled
              valueLabel={`${opacity}%`}
              aria-label="Opacidade da janela"
              oninput={(e: Event) => onChange({ opacity: Number(valueOf(e)) / 100 })}
            />
          </label>
          <label className="settings-switch">
            <span>
              <span className="type-body-medium">Sempre no topo</span>
              <span className="type-body-small">Mantém a janela por cima do editor</span>
            </span>
            <md-switch
              selected={config.alwaysOnTop}
              aria-label="Sempre no topo"
              onchange={(e: Event) => onChange({ alwaysOnTop: selectedOf(e) })}
            />
          </label>
          <label className="settings-switch">
            <span>
              <span className="type-body-medium">Notificar quando minimizado</span>
              <span className="type-body-small">Só com a janela minimizada ou na bandeja. Aparece se você compartilhar a tela inteira no Teams</span>
            </span>
            <md-switch
              selected={config.notifyMinimized}
              aria-label="Notificar quando minimizado"
              onchange={(e: Event) => onChange({ notifyMinimized: selectedOf(e) })}
            />
          </label>
          <label className="settings-switch">
            <span>
              <span className="type-body-medium">Modo terminal</span>
              <span className="type-body-small">Deixa o app com cara de terminal, até no título. Volta com /tema</span>
            </span>
            <md-switch
              selected={config.terminalMode}
              aria-label="Modo terminal"
              onchange={(e: Event) => onChange({ terminalMode: selectedOf(e) })}
            />
          </label>
        </section>

        <section>
          <h2 className="type-title-small">Atalhos</h2>
          <dl className="shortcuts">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd className="type-body-medium">{action}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="tip type-body-small">
          <md-icon aria-hidden="true">tips_and_updates</md-icon>
          Para o PairLAN não aparecer no Teams: compartilhe só uma janela ou só um monitor, e deixe este app no outro.
        </p>
      </div>
      <div slot="actions">
        <md-text-button onClick={onClose}>Fechar</md-text-button>
      </div>
    </md-dialog>
  )
}
