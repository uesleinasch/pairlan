import type { AlertLevel } from '../../shared/protocol'

export type AlertKind = AlertLevel | 'shake'

export type OutgoingAlert = { kind: AlertKind; seen: boolean }

const RANK: Record<AlertKind, number> = { shake: 0, yellow: 1, red: 2 }

export const strongerAlert = (prev: AlertKind | null, next: AlertKind): AlertKind =>
  prev && RANK[prev] > RANK[next] ? prev : next

export function incomingText(kind: AlertKind, peer: string): string {
  switch (kind) {
    case 'red':
      return `${peer} precisa de você agora`
    case 'yellow':
      return `${peer} está chamando sua atenção`
    default:
      return `${peer} chacoalhou sua janela`
  }
}

export const ALERT_LABEL: Record<AlertKind, string> = {
  yellow: 'Alerta amarelo',
  red: 'Alerta vermelho',
  shake: 'Chacoalhar'
}

export function outgoingText(alert: OutgoingAlert, peer: string): string {
  return alert.seen ? `${peer} viu` : `${ALERT_LABEL[alert.kind].toLowerCase()} enviado · aguardando ${peer}`
}
