import { describe, expect, it } from 'vitest'
import type { InternetStatus } from '../../shared/api'
import { internetSummary } from './internet'

const base: InternetStatus = {
  state: 'off',
  error: null,
  relayUrl: 'https://relay.example.workers.dev',
  me: 'ana',
  myFingerprint: '0000 0000 0000 0000 0000 0000',
  peer: 'bia',
  peerFingerprint: '1111 1111 1111 1111 1111 1111'
}

describe('internetSummary', () => {
  it('guides the setup in order', () => {
    expect(internetSummary({ ...base, relayUrl: '' })).toMatch(/Sem servidor/)
    expect(internetSummary({ ...base, me: '' })).toMatch(/Registre/)
    expect(internetSummary({ ...base, peer: null })).toBe('Você é @ana. Adicione o usuário do seu par.')
  })

  it('describes each link state', () => {
    expect(internetSummary({ ...base, state: 'waiting-peer' })).toMatch(/@bia.*@ana/)
    expect(internetSummary({ ...base, state: 'connected' })).toMatch(/cifrado/)
    expect(internetSummary({ ...base, state: 'error', error: 'caiu' })).toBe('caiu')
    expect(internetSummary(base)).toMatch(/mesma rede/)
  })
})
