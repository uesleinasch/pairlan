type Props = {
  peerName: string
  muted: boolean
  volume: number
  ducked: boolean
  onToggleMute: () => void
  onVolume: (v: number) => void
}

export function SystemAudioBar({ peerName, muted, volume, ducked, onToggleMute, onVolume }: Props) {
  return (
    <section className="card sysaudio" aria-label={`Áudio do PC de ${peerName}`}>
      <md-icon aria-hidden="true">headphones</md-icon>
      <div className="sysaudio-text">
        <span className="type-title-small">Áudio do PC de {peerName}</span>
        <span className="type-body-small">{ducked ? 'Abaixado enquanto você fala' : muted ? 'Silenciado' : 'Tocando'}</span>
      </div>
      <md-slider
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        aria-label="Volume"
        oninput={(e: Event) => onVolume(Number((e.target as HTMLInputElement).value) / 100)}
      />
      <md-icon-button
        onClick={onToggleMute}
        aria-label={muted ? 'Ouvir' : 'Silenciar'}
        title={muted ? 'Ouvir' : 'Silenciar'}
      >
        <md-icon>{muted ? 'volume_off' : 'volume_up'}</md-icon>
      </md-icon-button>
    </section>
  )
}
