import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '../shared/protocol'
import { broadcastAddresses, encodeBeacon, parseBeacon, shouldInitiate, type Beacon } from './discovery'

const beacon: Beacon = { app: 'pairlan', v: PROTOCOL_VERSION, id: 'abc', name: 'Ana', linkPort: 47801 }

describe('beacon', () => {
  it('round-trips', () => {
    expect(parseBeacon(encodeBeacon(beacon))).toEqual(beacon)
  })

  it('ignores foreign or invalid packets', () => {
    expect(parseBeacon(Buffer.from('garbage'))).toBeNull()
    expect(parseBeacon(encodeBeacon({ ...beacon, app: 'other' as 'pairlan' }))).toBeNull()
    expect(parseBeacon(encodeBeacon({ ...beacon, v: 999 }))).toBeNull()
    expect(parseBeacon(encodeBeacon({ ...beacon, linkPort: 70000 }))).toBeNull()
  })
})

describe('broadcastAddresses', () => {
  it('computes subnet broadcast for external IPv4 interfaces', () => {
    const addrs = broadcastAddresses({
      lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true, mac: '', cidr: null }],
      wlan0: [
        { address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4', internal: false, mac: '', cidr: null },
        { address: 'fe80::1', netmask: 'ffff::', family: 'IPv6', internal: false, mac: '', cidr: null, scopeid: 0 }
      ],
      eth0: [{ address: '10.20.3.4', netmask: '255.255.0.0', family: 'IPv4', internal: false, mac: '', cidr: null }]
    })
    expect(addrs).toEqual(['192.168.1.255', '10.20.255.255', '255.255.255.255'])
  })
})

describe('shouldInitiate', () => {
  it('lets exactly one side open the link', () => {
    expect(shouldInitiate('a', 'b')).toBe(true)
    expect(shouldInitiate('b', 'a')).toBe(false)
  })
})
