import type { LinkStatus } from '../../shared/api'

type Props = {
  status: LinkStatus
  sharing: boolean
  onShare: () => void
  onStopShare: () => void
  onToggleSettings: () => void
}

const api = window.pairlan

export function TitleBar({ status, sharing, onShare, onStopShare, onToggleSettings }: Props) {
  const connected = status.state === 'connected'
  const label = connected ? status.peer.name : status.state === 'connecting' ? 'conectando…' : 'procurando par na rede…'

  return (
    <header className="bar drag">
      <span className={`dot ${status.state}`} />
      <span className="peer">{label}</span>
      <div className="no-drag actions">
        {sharing ? (
          <button className="danger" onClick={onStopShare}>
            Parar
          </button>
        ) : (
          <button onClick={onShare} disabled={!connected} title="Compartilhar tela">
            Compartilhar
          </button>
        )}
        <button className="ghost" onClick={onToggleSettings} title="Configurações">
          ⚙
        </button>
        <button className="ghost" onClick={api.minimizeWindow} title="Minimizar">
          –
        </button>
        <button className="ghost" onClick={api.hideWindow} title="Esconder na bandeja">
          ✕
        </button>
      </div>
    </header>
  )
}
