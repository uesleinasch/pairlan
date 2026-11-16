import { useState } from 'react'
import type { LinkStatus } from '../../shared/api'
import { ALERT_LABEL, outgoingText, type AlertKind, type OutgoingAlert } from './alerts'

type Props = {
  status: LinkStatus
  searching: boolean
  outgoing: string[]
  onToggleSearch: () => void
  onOpenSettings: () => void
  alert: OutgoingAlert | null
  onAlert: (kind: AlertKind) => void
}

const ALERT_ICON: Record<AlertKind, string> = { yellow: 'warning', red: 'error', shake: 'vibration' }

const STATUS_ICON: Record<LinkStatus['state'], string> = {
  idle: 'wifi_find',
  connecting: 'sync',
  connected: 'link'
}

export function TopAppBar({ status, searching, outgoing, onToggleSearch, onOpenSettings, alert, onAlert }: Props) {
  const [alertMenu, setAlertMenu] = useState(false)
  const title = status.state === 'connected' ? status.peer.name : 'PairLAN'
  const base =
    status.state === 'connected'
      ? `Conectado${status.via === 'internet' ? ' · via internet' : status.address ? ` · ${status.address}` : ''}`
      : status.state === 'connecting'
        ? 'Conectando…'
        : searching
          ? 'Procurando o par na rede…'
          : 'Busca pausada'
  const withMedia = outgoing.length ? `${base} · transmitindo ${outgoing.join(', ')}` : base
  const subtitle = alert && status.state === 'connected' ? `${withMedia} · ${outgoingText(alert, status.peer.name)}` : withMedia

  return (
    <header className="top-app-bar">
      <span className={`status-avatar ${status.state}`} aria-hidden="true">
        <md-icon>{status.state === 'idle' && !searching ? 'search_off' : STATUS_ICON[status.state]}</md-icon>
      </span>
      <div className="top-app-bar-text">
        <h1 className="type-title-medium">{title}</h1>
        <p className={outgoing.length ? 'type-body-small live' : 'type-body-small'} role="status">
          {subtitle}
        </p>
      </div>
      <div className="top-app-bar-actions">
        {status.state !== 'connected' && (
          <md-icon-button
            onClick={onToggleSearch}
            aria-label={searching ? 'Parar busca' : 'Procurar de novo'}
            title={searching ? 'Parar busca' : 'Procurar de novo'}
          >
            <md-icon>{searching ? 'search_off' : 'wifi_find'}</md-icon>
          </md-icon-button>
        )}
        {status.state === 'connected' && (
          <span className="alert-anchor">
            <md-icon-button
              id="alert-button"
              className={alert ? `alert-button ${alert.seen ? 'seen' : alert.kind}` : 'alert-button'}
              onClick={() => setAlertMenu((open) => !open)}
              aria-label="Chamar atenção do par"
              title="Chamar atenção do par"
              aria-haspopup="menu"
              aria-expanded={alertMenu}
            >
              <md-icon>{alert?.seen ? 'check_circle' : 'campaign'}</md-icon>
            </md-icon-button>
            <md-menu anchor="alert-button" positioning="fixed" open={alertMenu} onclosed={() => setAlertMenu(false)}>
              {(['yellow', 'red', 'shake'] as const).map((kind) => (
                <md-menu-item key={kind} className={`alert-item ${kind}`} onClick={() => onAlert(kind)}>
                  <md-icon slot="start">{ALERT_ICON[kind]}</md-icon>
                  <div slot="headline">{ALERT_LABEL[kind]}</div>
                </md-menu-item>
              ))}
            </md-menu>
          </span>
        )}
        <md-icon-button onClick={onOpenSettings} aria-label="Configurações" title="Configurações">
          <md-icon>settings</md-icon>
        </md-icon-button>
      </div>
    </header>
  )
}
