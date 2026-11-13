import { afterEach, describe, expect, it } from 'vitest'
import type { LinkStatus } from '../shared/api'
import type { WireMessage } from '../shared/protocol'
import { isPrivateAddress, parseAddress, PeerLink } from './peer-link'

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
    const a = new PeerLink({ id: 'a', name: 'Ana' }, 0)
    const b = new PeerLink({ id: 'b', name: 'Bia' }, 0)
    links.push(a, b)
    await Promise.all([a.start(), b.start()])
    const bPort = b.listeningPort()

    const aUp = waitFor<LinkStatus>(a, 'status', connected)
    const bUp = waitFor<LinkStatus>(b, 'status', connected)
    a.connectTo('127.0.0.1', bPort)
    expect((await aUp).peer?.name).toBe('Bia')
    expect((await bUp).peer?.name).toBe('Ana')

    const got = waitFor<WireMessage>(b, 'message', (m) => m.t === 'chat')
    a.send({ t: 'chat', msg: { id: '1', from: 'a', fromName: 'Ana', text: 'oi', ts: 1 } })
    expect(await got).toMatchObject({ t: 'chat', msg: { text: 'oi' } })

    await b.stop()
    const b2 = new PeerLink({ id: 'b', name: 'Bia 2' }, bPort)
    links.push(b2)
    const aBack = waitFor<LinkStatus>(a, 'status', (s) => s.state === 'connected' && s.peer.name === 'Bia 2')
    await b2.start()
    expect((await aBack).peer?.name).toBe('Bia 2')
  }, 15000)

  it('accepts only one peer at a time', async () => {
    const a = new PeerLink({ id: 'a', name: 'Ana' }, 0)
    const b = new PeerLink({ id: 'b', name: 'Bia' }, 0)
    const c = new PeerLink({ id: 'c', name: 'Caio' }, 0)
    links.push(a, b, c)
    await Promise.all([a.start(), b.start(), c.start()])
    const aPort = a.listeningPort()

    const aUp = waitFor<LinkStatus>(a, 'status', connected)
    b.connectTo('127.0.0.1', aPort)
    await aUp
    c.connectTo('127.0.0.1', aPort)
    await new Promise((r) => setTimeout(r, 500))
    expect(a.status()).toMatchObject({ state: 'connected', peer: { id: 'b' } })
    expect(c.isConnected()).toBe(false)
  })
})

describe('parseAddress', () => {
  it('parses ip with optional port', () => {
    expect(parseAddress(' 192.168.0.5 ', 47801)).toEqual({ address: '192.168.0.5', port: 47801 })
    expect(parseAddress('10.0.0.2:5000', 47801)).toEqual({ address: '10.0.0.2', port: 5000 })
    expect(parseAddress('[fe80::1]:6000', 47801)).toEqual({ address: 'fe80::1', port: 6000 })
  })

  it('rejects hostnames, public ips and bad ports', () => {
    expect(parseAddress('pc-do-junior', 47801)).toBeNull()
    expect(parseAddress('8.8.8.8', 47801)).toBeNull()
    expect(parseAddress('192.168.0.5:99999', 47801)).toBeNull()
  })
})
