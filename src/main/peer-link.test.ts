import { afterEach, describe, expect, it } from 'vitest'
import type { LinkStatus } from '../shared/api'
import type { WireMessage } from '../shared/protocol'
import { isPrivateAddress, PeerLink } from './peer-link'

describe('isPrivateAddress', () => {
  it('accepts LAN and loopback', () => {
    for (const a of ['10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.9', '169.254.3.3', '127.0.0.1', '::1', '::ffff:192.168.0.2', 'fe80::1', 'fd00::2']) {
      expect(isPrivateAddress(a), a).toBe(true)
    }
  })

  it('rejects public addresses', () => {
    for (const a of ['8.8.8.8', '172.32.0.1', '192.169.0.1', '2001:db8::1', '::ffff:1.1.1.1', '', undefined]) {
      expect(isPrivateAddress(a), String(a)).toBe(false)
    }
  })
})

const links: PeerLink[] = []
afterEach(async () => {
  await Promise.all(links.splice(0).map((l) => l.stop()))
})

const waitFor = <T>(link: PeerLink, event: 'status' | 'message', match: (v: T) => boolean) =>
  new Promise<T>((resolve) => {
    const handler = (v: T) => {
      if (!match(v)) return
      link.off(event, handler as never)
      resolve(v)
    }
    link.on(event, handler as never)
  })

const connected = (s: LinkStatus) => s.state === 'connected'

describe('PeerLink', () => {
  it('connects two peers, exchanges messages and reconnects', async () => {
    const a = new PeerLink({ id: 'a', name: 'Ana' }, 48101)
    const b = new PeerLink({ id: 'b', name: 'Bia' }, 48102)
    links.push(a, b)
    await Promise.all([a.start(), b.start()])

    const aUp = waitFor<LinkStatus>(a, 'status', connected)
    const bUp = waitFor<LinkStatus>(b, 'status', connected)
    a.connectTo('127.0.0.1', 48102)
    expect((await aUp).peer?.name).toBe('Bia')
    expect((await bUp).peer?.name).toBe('Ana')

    const got = waitFor<WireMessage>(b, 'message', (m) => m.t === 'chat')
    a.send({ t: 'chat', msg: { id: '1', from: 'a', fromName: 'Ana', text: 'oi', ts: 1 } })
    expect(await got).toMatchObject({ t: 'chat', msg: { text: 'oi' } })

    await b.stop()
    const b2 = new PeerLink({ id: 'b', name: 'Bia 2' }, 48102)
    links.push(b2)
    const aBack = waitFor<LinkStatus>(a, 'status', (s) => s.state === 'connected' && s.peer.name === 'Bia 2')
    await b2.start()
    expect((await aBack).peer?.name).toBe('Bia 2')
  }, 15000)

  it('accepts only one peer at a time', async () => {
    const a = new PeerLink({ id: 'a', name: 'Ana' }, 48111)
    const b = new PeerLink({ id: 'b', name: 'Bia' }, 48112)
    const c = new PeerLink({ id: 'c', name: 'Caio' }, 48113)
    links.push(a, b, c)
    await Promise.all([a.start(), b.start(), c.start()])

    const aUp = waitFor<LinkStatus>(a, 'status', connected)
    b.connectTo('127.0.0.1', 48111)
    await aUp
    c.connectTo('127.0.0.1', 48111)
    await new Promise((r) => setTimeout(r, 500))
    expect(a.status()).toMatchObject({ state: 'connected', peer: { id: 'b' } })
    expect(c.isConnected()).toBe(false)
  })
})
