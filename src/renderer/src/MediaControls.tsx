import { ToggleChip } from './ToggleChip'

type Props = {
  connected: boolean
  sharingScreen: boolean
  sharingAudio: boolean
  audioBusy: boolean
  controlAllowed: boolean
  controlBusy: boolean
  onToggleControl: () => void
  liveAudio: boolean
  onToggleScreen: () => void
  onToggleAudio: () => void
  onToggleLiveAudio: () => void
}

export function MediaControls(p: Props) {
  return (
    <md-chip-set className="media-controls" aria-label="Mídia">
      <ToggleChip
        label={p.sharingScreen ? 'Parar tela' : 'Minha tela'}
        icon={p.sharingScreen ? 'stop_screen_share' : 'screen_share'}
        selected={p.sharingScreen}
        disabled={!p.connected}
        title={p.sharingScreen ? 'Parar de compartilhar a tela' : 'Compartilhar minha tela com o par'}
        onToggle={p.onToggleScreen}
      />
      {p.sharingScreen && (
        <ToggleChip
          label={p.controlAllowed ? 'Bloquear controle' : 'Permitir controle'}
          icon={p.controlAllowed ? 'block' : 'mouse'}
          selected={p.controlAllowed}
          disabled={p.controlBusy}
          title={
            p.controlAllowed
              ? 'O par está podendo usar seu mouse e teclado. Clique para bloquear'
              : 'Deixar o par usar seu mouse e teclado enquanto vê sua tela'
          }
          onToggle={p.onToggleControl}
        />
      )}
      <ToggleChip
        label={p.sharingAudio ? 'Parar áudio' : 'Áudio do PC'}
        icon={p.sharingAudio ? 'stop_circle' : 'speaker'}
        selected={p.sharingAudio}
        disabled={!p.connected || p.audioBusy}
        title={p.sharingAudio ? 'Parar de transmitir o áudio do PC' : 'Transmitir o som do PC, sem a tela'}
        onToggle={p.onToggleAudio}
      />
      <ToggleChip
        label="Ouvir ao vivo"
        icon={p.liveAudio ? 'hearing' : 'hearing_disabled'}
        selected={p.liveAudio}
        title={
          p.liveAudio
            ? 'Ligado: a voz do par toca na hora. Desligue em calls para receber como mensagem'
            : 'Desligado: a voz do par chega como mensagem de voz'
        }
        onToggle={p.onToggleLiveAudio}
      />
    </md-chip-set>
  )
}
