import type { LinkStatus } from '../../shared/api'

type Props = {
  status: LinkStatus
  liveAudio: boolean
  onToggleLiveAudio: () => void
  sharing: boolean
  sharingAudio: boolean
  audioBusy: boolean
  onToggleAudio: () => void
  onShare: () => void
  onStopShare: () => void
  onToggleSettings: () => void
}

const api = window.pairlan

export function TitleBar({
  status,
  liveAudio,
  onToggleLiveAudio,
  sharing,
  sharingAudio,
  audioBusy,
  onToggleAudio,
  onShare,
  onStopShare,
  onToggleSettings
}: Props) {
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
        <button
          className={sharingAudio ? 'ghost on' : 'ghost'}
          onClick={onToggleAudio}
          disabled={!connected || audioBusy}
          title={sharingAudio ? 'Parar de transmitir o áudio do PC' : 'Transmitir o áudio do PC (sem tela)'}
        >
          🎧
        </button>
        <button
          className="ghost"
          onClick={onToggleLiveAudio}
          title={liveAudio ? 'Ouvindo áudio ao vivo. Clique para receber como mensagem (ex.: em call)' : 'Áudio chega como mensagem. Clique para ouvir ao vivo'}
        >
          {liveAudio ? '🔊' : '🔇'}
        </button>
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
