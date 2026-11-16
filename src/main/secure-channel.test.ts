import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fingerprint, generateIdentity, loadIdentity, verifySignature } from './identity'
import { createHandshake, isHandshakeFrame } from './secure-channel'

describe('identity', () => {
  it('signs and verifies with the raw public key', () => {
    const id = generateIdentity()
    expect(id.publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const sig = id.sign('oi')
    expect(verifySignature(id.publicKey, 'oi', sig)).toBe(true)
    expect(verifySignature(id.publicKey, 'tchau', sig)).toBe(false)
    expect(verifySignature(generateIdentity().publicKey, 'oi', sig)).toBe(false)
    expect(verifySignature('lixo', 'oi', sig)).toBe(false)
  })

  it('persists the key with private permissions and reloads it', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pairlan-id-')), 'identity.json')
    const first = loadIdentity(file)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(loadIdentity(file).publicKey).toBe(first.publicKey)
  })

  it('keeps a corrupted file aside and starts a new key', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pairlan-id-')), 'identity.json')
    writeFileSync(file, 'nao e json')
    expect(loadIdentity(file).publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('nao e json')
  })

  it('fingerprint is stable and readable', () => {
    const id = generateIdentity()
    expect(fingerprint(id.publicKey)).toMatch(/^(\d{4} ){5}\d{4}$/)
    expect(fingerprint(id.publicKey)).toBe(fingerprint(id.publicKey))
  })
})

describe('secure channel', () => {
  const ana = generateIdentity()
  const bia = generateIdentity()

  const pair = () => {
    const a = createHandshake(ana, 'ana', 'bia', bia.publicKey)
    const b = createHandshake(bia, 'bia', 'ana', ana.publicKey)
    return { a, b }
  }

  it('derives matching ciphers in both directions', () => {
    const { a, b } = pair()
    expect(isHandshakeFrame(a.hello)).toBe(true)
    const ca = a.accept(b.hello)!
    const cb = b.accept(a.hello)!
    expect(cb.open(ca.seal('oi bia'))).toBe('oi bia')
    expect(ca.open(cb.seal('oi ana'))).toBe('oi ana')
    expect(cb.open(ca.seal('ção 🚀'))).toBe('ção 🚀')
  })

  it('refuses a hello signed by another key', () => {
    const mallory = generateIdentity()
    const fake = createHandshake(mallory, 'bia', 'ana', ana.publicKey)
    const a = createHandshake(ana, 'ana', 'bia', bia.publicKey)
    expect(a.accept(fake.hello)).toBeNull()
  })

  it('refuses a hello meant for another pair', () => {
    const a = createHandshake(ana, 'ana', 'bia', bia.publicKey)
    const other = createHandshake(bia, 'bia', 'caio', ana.publicKey)
    expect(a.accept(other.hello)).toBeNull()
  })

  it('refuses tampered, replayed and out of order frames', () => {
    const { a, b } = pair()
    const ca = a.accept(b.hello)!
    const cb = b.accept(a.hello)!
    const first = ca.seal('um')
    const second = ca.seal('dois')

    const parsed = JSON.parse(first)
    const body = Buffer.from(parsed.c, 'base64')
    body[0] ^= 1
    expect(cb.open(JSON.stringify({ ...parsed, c: body.toString('base64') }))).toBeNull()

    expect(cb.open(second)).toBeNull()
    expect(cb.open(first)).toBe('um')
    expect(cb.open(first)).toBeNull()
    expect(cb.open(second)).toBe('dois')
    expect(cb.open('lixo')).toBeNull()
  })

  it('a relay that swaps the ephemeral key cannot read', () => {
    const { a, b } = pair()
    const mitm = createHandshake(bia, 'bia', 'ana', ana.publicKey)
    const hello = JSON.parse(b.hello)
    const swapped = JSON.stringify({ ...hello, e: JSON.parse(mitm.hello).e })
    expect(a.accept(swapped)).toBeNull()
  })
})
