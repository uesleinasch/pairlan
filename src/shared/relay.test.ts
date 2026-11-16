import { describe, expect, it } from 'vitest'
import { authMessage, isPublicKey, normalizeUsername, parseRelayControl, roomKey } from './relay'

describe('normalizeUsername', () => {
  it('accepts and normalizes valid names', () => {
    expect(normalizeUsername(' @Ana_Dev ')).toBe('ana_dev')
    expect(normalizeUsername('bia')).toBe('bia')
  })

  it('rejects short, long and odd names', () => {
    for (const v of ['ab', 'a'.repeat(21), 'ana dev', 'ana-dev', 'ç', '', 7, null]) {
      expect(normalizeUsername(v), String(v)).toBeNull()
    }
  })
})

describe('relay helpers', () => {
  it('room key ignores order', () => {
    expect(roomKey('bia', 'ana')).toBe('ana|bia')
    expect(roomKey('ana', 'bia')).toBe('ana|bia')
  })

  it('auth message binds nonce and both names', () => {
    expect(authMessage('n1', 'ana', 'bia')).toBe('pairlan-relay-v1|n1|ana|bia')
  })

  it('checks public key shape', () => {
    expect(isPublicKey('A'.repeat(43))).toBe(true)
    expect(isPublicKey('A'.repeat(44))).toBe(false)
    expect(isPublicKey('A'.repeat(42) + '=')).toBe(false)
  })
})

describe('parseRelayControl', () => {
  it('parses known control frames', () => {
    expect(parseRelayControl('{"r":"challenge","nonce":"x"}')).toEqual({ r: 'challenge', nonce: 'x' })
    expect(parseRelayControl('{"r":"peer","online":true}')).toEqual({ r: 'peer', online: true })
    expect(parseRelayControl('{"r":"error","reason":"auth"}')).toEqual({ r: 'error', reason: 'auth' })
  })

  it('keeps only valid ice servers', () => {
    const raw = JSON.stringify({
      r: 'ready',
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 5 }, { urls: ['turn:x'], username: 'u', credential: 'c' }]
    })
    expect(parseRelayControl(raw)).toEqual({
      r: 'ready',
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: ['turn:x'], username: 'u', credential: 'c' }]
    })
  })

  it('ignores data frames and junk', () => {
    for (const raw of ['{"n":"0","c":"x"}', '{"e":"x","sig":"y"}', 'lixo', '{"r":"peer"}', '{"r":"outro"}']) {
      expect(parseRelayControl(raw), raw).toBeNull()
    }
  })
})
