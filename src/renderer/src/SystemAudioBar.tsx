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
    <div className="sysaudio">
      <span>
        🎧 Áudio do PC de {peerName}
        {ducked && ' (abaixado enquanto você fala)'}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        aria-label="Volume"
      />
      <button className="ghost" onClick={onToggleMute} title={muted ? 'Ouvir' : 'Silenciar'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}
