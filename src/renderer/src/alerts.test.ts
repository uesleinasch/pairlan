import { describe, expect, it } from 'vitest'
import { incomingText, outgoingText, strongerAlert } from './alerts'

describe('alerts', () => {
  it('keeps the strongest pending alert', () => {
    expect(strongerAlert(null, 'shake')).toBe('shake')
    expect(strongerAlert('shake', 'yellow')).toBe('yellow')
    expect(strongerAlert('yellow', 'red')).toBe('red')
    expect(strongerAlert('red', 'yellow')).toBe('red')
    expect(strongerAlert('red', 'shake')).toBe('red')
  })

  it('describes incoming and outgoing alerts', () => {
    expect(incomingText('red', 'Ana')).toBe('Ana precisa de você agora')
    expect(incomingText('yellow', 'Ana')).toMatch(/atenção/)
    expect(incomingText('shake', 'Ana')).toMatch(/chacoalhou/)
    expect(outgoingText({ kind: 'red', seen: false }, 'Bia')).toBe('alerta vermelho enviado · aguardando Bia')
    expect(outgoingText({ kind: 'shake', seen: true }, 'Bia')).toBe('Bia viu')
  })
})
