import type { LinkStatus } from '../../shared/api'

type Props = {
  status: LinkStatus
  searching: boolean
  outgoing: string[]
  onToggleSearch: () => void
  onOpenSettings: () => void
}

const api = window.pairlan

const STATUS_ICON: Record<LinkStatus['state'], string> = {
  idle: 'wifi_find',
  connecting: 'sync',
  connected: 'link'
}

export function TopAppBar({ status, searching, outgoing, onToggleSearch, onOpenSettings }: Props) {
  const title = status.state === 'connected' ? status.peer.name : 'PairLAN'
  const base =
    status.state === 'connected'
      ? `Conectado${status.address ? ` · ${status.address}` : ''}`
      : status.state === 'connecting'
        ? 'Conectando…'
        : searching
          ? 'Procurando o par na rede…'
          : 'Busca pausada'
  const subtitle = outgoing.length ? `${base} · transmitindo ${outgoing.join(', ')}` : base

  return (
    <header className="top-app-bar drag">
      <span className={`status-avatar ${status.state}`} aria-hidden="true">
        <md-icon>{status.state === 'idle' && !searching ? 'search_off' : STATUS_ICON[status.state]}</md-icon>
      </span>
      <div className="top-app-bar-text">
        <h1 className="type-title-medium">{title}</h1>
        <p className={outgoing.length ? 'type-body-small live' : 'type-body-small'} role="status">
          {subtitle}
        </p>
      </div>
      <div className="no-drag top-app-bar-actions">
        {status.state !== 'connected' && (
          <md-icon-button
            onClick={onToggleSearch}
            aria-label={searching ? 'Parar busca' : 'Procurar de novo'}
            title={searching ? 'Parar busca' : 'Procurar de novo'}
          >
            <md-icon>{searching ? 'search_off' : 'wifi_find'}</md-icon>
          </md-icon-button>
        )}
        <md-icon-button onClick={onOpenSettings} aria-label="Configurações" title="Configurações">
          <md-icon>settings</md-icon>
        </md-icon-button>
        <md-icon-button onClick={api.minimizeWindow} aria-label="Minimizar" title="Minimizar">
          <md-icon>minimize</md-icon>
        </md-icon-button>
        <md-icon-button onClick={api.hideWindow} aria-label="Esconder na bandeja" title="Esconder na bandeja">
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>
    </header>
  )
}
