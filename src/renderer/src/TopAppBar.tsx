import type { LinkStatus } from '../../shared/api'

type Props = {
  status: LinkStatus
  outgoing: string[]
  onOpenSettings: () => void
}

const api = window.pairlan

const STATUS_ICON: Record<LinkStatus['state'], string> = {
  idle: 'wifi_find',
  connecting: 'sync',
  connected: 'link'
}

export function TopAppBar({ status, outgoing, onOpenSettings }: Props) {
  const title = status.state === 'connected' ? status.peer.name : 'PairLAN'
  const base =
    status.state === 'connected'
      ? `Conectado${status.address ? ` · ${status.address}` : ''}`
      : status.state === 'connecting'
        ? 'Conectando…'
        : 'Procurando o par na rede…'
  const subtitle = outgoing.length ? `${base} · transmitindo ${outgoing.join(', ')}` : base

  return (
    <header className="top-app-bar drag">
      <span className={`status-avatar ${status.state}`} aria-hidden="true">
        <md-icon>{STATUS_ICON[status.state]}</md-icon>
      </span>
      <div className="top-app-bar-text">
        <h1 className="type-title-medium">{title}</h1>
        <p className={outgoing.length ? 'type-body-small live' : 'type-body-small'} role="status">
          {subtitle}
        </p>
      </div>
      <div className="no-drag top-app-bar-actions">
        <md-icon-button onClick={onOpenSettings} aria-label="Configurações" title="Configurações">
          <md-icon>settings</md-icon>
        </md-icon-button>
        <md-icon-button onClick={api.minimizeWindow} aria-label="Minimizar" title="Minimizar">
          <md-icon>minimize</md-icon>
        </md-icon-button>
        <md-icon-button onClick={api.closeWindow} aria-label="Fechar" title="Fechar">
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>
    </header>
  )
}
