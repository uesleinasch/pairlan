import type { WifiDirectStatus } from '../../shared/api'

export function wifiSummary(w: WifiDirectStatus): string {
  switch (w.state) {
    case 'unsupported':
      return 'Esta placa Wi-Fi não tem Wi-Fi Direct.'
    case 'connecting':
      return 'Conectando… o par precisa estar ligando junto.'
    case 'on':
      return `Ligado. Este PC é ${w.ip}. A rede da empresa continua ligada.`
    case 'error':
      return w.error ?? 'O Wi-Fi Direct falhou.'
    default:
      return 'Liga os dois PCs direto, sem passar pela rede. A rede da empresa continua ligada.'
  }
}

export const canSwitchToWifi = (w: WifiDirectStatus, connected: boolean): boolean =>
  connected && Boolean(w.peer) && (w.state === 'off' || w.state === 'error')
