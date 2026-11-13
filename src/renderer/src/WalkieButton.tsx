import type { WalkieState } from './useWalkie'

type Props = {
  state: WalkieState
  peerLive: boolean
  disabled: boolean
  onStart: () => void
  onStop: () => void
}

const ICON: Record<WalkieState, string> = {
  idle: 'mic',
  connecting: 'hourglass_top',
  'on-air': 'graphic_eq',
  recording: 'fiber_manual_record'
}

export function WalkieButton({ state, peerLive, disabled, onStart, onStop }: Props) {
  const mode = peerLive ? 'ao vivo' : 'como mensagem de voz'
  const label = `Segure para falar ${mode} (atalho: segure Ctrl+Espaço)`
  return (
    <button
      type="button"
      className={`ptt ${state}`}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={state !== 'idle'}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onStart()
      }}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          onStart()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') onStop()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <md-ripple></md-ripple>
      <md-focus-ring></md-focus-ring>
      <md-icon>{ICON[state]}</md-icon>
    </button>
  )
}

export function walkieStatusText(state: WalkieState, peerLive: boolean): string {
  if (state === 'on-air') return 'No ar — pode falar'
  if (state === 'connecting') return 'Abrindo canal…'
  if (state === 'recording') return 'Gravando mensagem de voz…'
  return peerLive ? '' : 'O par está com "Ouvir ao vivo" desligado: sua fala chega como mensagem de voz'
}
