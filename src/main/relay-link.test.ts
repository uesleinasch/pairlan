import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import type { LinkStatus } from '../shared/api'
import type { WireMessage } from '../shared/protocol'
import { generateIdentity, type Identity } from './identity'
import { PeerLink } from './peer-link'
import { lookupUser, registerUser, RelayDialer, type RelayStatus } from './relay-link'

const RELAY = process.env.PAIRLAN_RELAY_TEST_URL

const cleanup: (() => unknown)[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()))
})

const name = (prefix: string) => `${prefix}_${randomBytes(4).toString('hex')}`

const until = <T>(emitter: { on(e: string, cb: (v: T) => void): unknown }, event: string, match: (v: T) => boolean) =>
  new Promise<T>((resolve) => emitter.on(event, (v: T) => match(v) && resolve(v)))

function side(identity: Identity, me: string, peer: string, peerKey: string, label: string) {
  const dialer = new RelayDialer(identity)
  const link = new PeerLink({ id: me, name: label }, 0)
  dialer.on('channel', (channel) => link.attach(channel))
  cleanup.push(() => dialer.stop(), () => link.stop())
  dialer.configure({ url: RELAY!, me, peer, peerPublicKey: peerKey })
  return { dialer, link }
}

describe.skipIf(!RELAY)('relay link against a running relay', () => {
  it('registers, looks up and refuses a taken name', async () => {
    const ana = generateIdentity()
    const user = name('ana')
    expect(await registerUser(RELAY!, ana, user)).toEqual({ ok: true })
    expect(await registerUser(RELAY!, ana, user)).toEqual({ ok: true })
    expect(await lookupUser(RELAY!, user)).toEqual({ ok: true, publicKey: ana.publicKey })
    expect(await registerUser(RELAY!, generateIdentity(), user)).toMatchObject({ ok: false, error: expect.stringMatching(/em uso/) })
    expect(await lookupUser(RELAY!, name('ninguem'))).toMatchObject({ ok: false })
  })

  it('connects two mutual contacts end to end', async () => {
    const ana = generateIdentity()
    const bia = generateIdentity()
    const [a, b] = [name('ana'), name('bia')]
    await registerUser(RELAY!, ana, a)
    await registerUser(RELAY!, bia, b)

    const left = side(ana, a, b, bia.publicKey, 'Ana')
    await until<RelayStatus>(left.dialer, 'status', (s) => s.state === 'waiting-peer')

    const right = side(bia, b, a, ana.publicKey, 'Bia')
    const iceSeen = until(right.dialer, 'ice', () => true)
    const up = until<LinkStatus>(left.link, 'status', (s) => s.state === 'connected')
    expect(await up).toMatchObject({ via: 'internet', peer: { name: 'Bia' } })
    expect(await iceSeen).toBeDefined()

    const got = until<WireMessage>(right.link, 'message', (m) => m.t === 'chat')
    left.link.send({ t: 'chat', msg: { id: '1', from: a, fromName: 'Ana', text: 'oi pela internet', ts: 1 } })
    expect(await got).toMatchObject({ msg: { text: 'oi pela internet' } })

    const down = until<LinkStatus>(left.link, 'status', (s) => s.state !== 'connected')
    right.dialer.stop()
    await down
    expect(left.dialer.status().state).toBe('waiting-peer')
  }, 20000)

  it('rejects someone using a name with another key', async () => {
    const ana = generateIdentity()
    const [a, b] = [name('ana'), name('bia')]
    await registerUser(RELAY!, ana, a)
    const impostor = side(generateIdentity(), a, b, generateIdentity().publicKey, 'Falso')
    const refused = await until<RelayStatus>(impostor.dialer, 'status', (s) => s.state === 'error')
    expect(refused.error).toMatch(/recusou/)
  }, 15000)

  it('refuses a peer whose key does not match the saved contact', async () => {
    const ana = generateIdentity()
    const bia = generateIdentity()
    const [a, b] = [name('ana'), name('bia')]
    await registerUser(RELAY!, ana, a)
    await registerUser(RELAY!, bia, b)
    const left = side(ana, a, b, generateIdentity().publicKey, 'Ana')
    side(bia, b, a, ana.publicKey, 'Bia')
    const failed = await until<RelayStatus>(left.dialer, 'status', (s) => s.state === 'error')
    expect(failed.error).toMatch(/não confere/)
    expect(left.link.isConnected()).toBe(false)
  }, 15000)
})
