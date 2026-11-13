import type { WalkieState } from './useWalkie'

type Props = {
  state: WalkieState
  peerLive: boolean
  disabled: boolean
  onStart: () => void
  onStop: () => void
}

const LABEL: Record<WalkieState, string> = {
  idle: '🎙',
  connecting: '…',
  'on-air': '🔴',
  recording: '⏺'
}

export function WalkieButton({ state, peerLive, disabled, onStart, onStop }: Props) {
  const mode = peerLive ? 'ao vivo' : 'como mensagem de voz (o par está em 🔇)'
  return (
    <button
      className={state === 'idle' ? 'ghost walkie' : 'ghost walkie active'}
      disabled={disabled}
      title={`Segure para falar ${mode} — atalho: segure Ctrl+Espaço`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onStart()
      }}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {LABEL[state]}
    </button>
  )
}

export function walkieStatusText(state: WalkieState, peerLive: boolean): string {
  if (state === 'on-air') return 'No ar — pode falar'
  if (state === 'connecting') return 'Abrindo canal…'
  if (state === 'recording') return 'Gravando mensagem de voz…'
  return peerLive ? '' : 'Par está em 🔇: sua fala vai como mensagem de voz'
}
