import { describe, expect, it } from 'vitest'
import { generateIdentity } from '../../src/main/identity'
import { authMessage } from '../../src/shared/relay'
import { FALLBACK_ICE, iceServersFrom, isFreshTimestamp, randomNonce, verifyEd25519 } from './logic'

describe('verifyEd25519', () => {
  it('accepts signatures made by the app identity', async () => {
    const id = generateIdentity()
    const msg = authMessage(randomNonce(), 'ana', 'bia')
    expect(await verifyEd25519(id.publicKey, msg, id.sign(msg))).toBe(true)
  })

  it('rejects wrong key, wrong message and junk', async () => {
    const id = generateIdentity()
    const sig = id.sign('a')
    expect(await verifyEd25519(generateIdentity().publicKey, 'a', sig)).toBe(false)
    expect(await verifyEd25519(id.publicKey, 'b', sig)).toBe(false)
    expect(await verifyEd25519('xx', 'a', sig)).toBe(false)
    expect(await verifyEd25519(id.publicKey, 'a', 'xx')).toBe(false)
  })
})

describe('iceServersFrom', () => {
  it('drops port 53 urls and keeps credentials', () => {
    const body = {
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
        {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp'],
          username: 'u',
          credential: 'c'
        }
      ]
    }
    expect(iceServersFrom(body)).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }
    ])
  })

  it('falls back to public stun on bad answers', () => {
    expect(iceServersFrom(null)).toBe(FALLBACK_ICE)
    expect(iceServersFrom({ iceServers: [{ urls: 7 }] })).toBe(FALLBACK_ICE)
  })
})

describe('helpers', () => {
  it('nonces are random and url safe', () => {
    const a = randomNonce()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(randomNonce()).not.toBe(a)
  })

  it('timestamps must be close to now', () => {
    expect(isFreshTimestamp(1000, 1000 + 60_000)).toBe(true)
    expect(isFreshTimestamp(1000, 1000 + 10 * 60_000)).toBe(false)
    expect(isFreshTimestamp('1000', 1000)).toBe(false)
  })
})
