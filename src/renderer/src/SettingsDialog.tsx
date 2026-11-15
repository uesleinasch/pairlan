import { useEffect, useState, type KeyboardEvent } from 'react'
import type { AppConfig, WifiDirectStatus } from '../../shared/api'
import { canSwitchToWifi, wifiSummary } from './wifi'

const api = window.pairlan

type Props = {
  open: boolean
  config: AppConfig
  onClose: () => void
  onChange: (patch: Partial<AppConfig>) => void
  onConnect: (address: string) => Promise<boolean>
  onClearHistory: () => Promise<void>
  wifi: WifiDirectStatus
  connected: boolean
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

export function SettingsDialog({ open, config, onClose, onChange, onConnect, onClearHistory, wifi, connected }: Props) {
  const [name, setName] = useState(config.name)
  const [address, setAddress] = useState(config.manualPeer)
  const [addressError, setAddressError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [p2pAddress, setP2pAddress] = useState(config.wifiDirectPeer)
  const [p2pError, setP2pError] = useState('')
  const opacity = Math.round(config.opacity * 100)

  useEffect(() => {
    if (!open) return
    setName(config.name)
    setAddress(config.manualPeer)
    setAddressError('')
    setConfirmClear(false)
    setP2pAddress(config.wifiDirectPeer)
    setP2pError('')
  }, [open, config.name, config.manualPeer, config.wifiDirectPeer])

  const startWifi = async (peer?: string) => {
    const result = await api.startWifiDirect(peer)
    setP2pError(result.ok ? '' : result.error)
  }

  const wifiBusy = wifi.state === 'on' || wifi.state === 'connecting'

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
          <h2 className="type-title-small">Wi-Fi Direct</h2>
          <p className="settings-note type-body-small" role="status">
            {wifiSummary(wifi)}
          </p>
          {wifiBusy && (
            <md-filled-tonal-button onClick={() => api.stopWifiDirect()}>
              {wifi.state === 'on' ? 'Desligar Wi-Fi Direct' : 'Cancelar'}
            </md-filled-tonal-button>
          )}
          {!wifiBusy && wifi.state !== 'unsupported' && (
            <>
              {canSwitchToWifi(wifi, connected) && (
                <md-filled-button onClick={() => void startWifi()}>
                  <md-icon slot="icon">wifi_tethering</md-icon>
                  Mudar para Wi-Fi Direct
                </md-filled-button>
              )}
              <div className="settings-row">
                <md-outlined-text-field
                  label="Endereço do par"
                  placeholder="fc:b3:aa:bc:44:ff"
                  value={p2pAddress}
                  supportingText={`Sem rede em comum: o seu é ${wifi.self}. Os dois clicam juntos.`}
                  error={Boolean(p2pError)}
                  errorText={p2pError}
                  oninput={(e: Event) => setP2pAddress(valueOf(e))}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') void startWifi(p2pAddress)
                  }}
                />
                <md-filled-tonal-button onClick={() => void startWifi(p2pAddress)}>Conectar</md-filled-tonal-button>
              </div>
            </>
          )}
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
          <h2 className="type-title-small">Histórico</h2>
          <p className="settings-note type-body-small">
            Apaga as mensagens deste PC. O par continua com as dele, e os arquivos recebidos ficam em Downloads/PairLAN.
          </p>
          {confirmClear ? (
            <div className="settings-row">
              <md-filled-button
                className="danger"
                onClick={() => void onClearHistory().then(() => setConfirmClear(false))}
              >
                Apagar tudo
              </md-filled-button>
              <md-text-button onClick={() => setConfirmClear(false)}>Cancelar</md-text-button>
            </div>
          ) : (
            <md-filled-tonal-button onClick={() => setConfirmClear(true)}>
              <md-icon slot="icon">delete</md-icon>
              Apagar histórico
            </md-filled-tonal-button>
          )}
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
