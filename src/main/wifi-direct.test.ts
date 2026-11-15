import { describe, expect, it } from 'vitest'
import type { WifiDirectStatus } from '../shared/api'
import { p2pAddresses, parseP2pDevice, P2P_CONNECTION, WifiDirect, type Exec } from './wifi-direct'

const IW_DEV = `phy#0
	Interface p2p-wlp0s20-0
		ifindex 8
		addr fc:b3:aa:bc:44:00
		type P2P-client
	Unnamed/non-netdev interface
		wdev 0x2
		addr FC:B3:AA:BC:44:FF
		type P2P-device
	Interface wlp0s20f3
		addr fc:b3:aa:bc:44:fe
		type managed
`

describe('parseP2pDevice', () => {
  it('reads the P2P device address, not the group or station one', () => {
    expect(parseP2pDevice(IW_DEV)).toBe('fc:b3:aa:bc:44:ff')
  })

  it('returns null without a P2P device', () => {
    expect(parseP2pDevice('phy#0\n\tInterface wlan0\n\t\taddr aa:bb:cc:dd:ee:ff\n\t\ttype managed\n')).toBeNull()
  })
})

describe('p2pAddresses', () => {
  it('gives each side a different IP and makes exactly one side dial', () => {
    const a = p2pAddresses('9c:97:1b:26:9f:18', 'fc:b3:aa:bc:44:ff')
    const b = p2pAddresses('fc:b3:aa:bc:44:ff', '9c:97:1b:26:9f:18')
    expect(a).toEqual({ mine: '10.42.99.1', other: '10.42.99.2', dials: false })
    expect(b).toEqual({ mine: '10.42.99.2', other: '10.42.99.1', dials: true })
  })
})

type Call = { cmd: string; args: string[] }

function fakeExec(upResults: boolean[]): { exec: Exec; calls: Call[] } {
  const calls: Call[] = []
  const exec: Exec = async (cmd, args) => {
    calls.push({ cmd, args })
    if (cmd === 'iw') return IW_DEV
    if (args.includes('up')) {
      if (upResults.shift()) return ''
      throw new Error('timeout')
    }
    return ''
  }
  return { exec, calls }
}

const states = (wifi: WifiDirect) => {
  const seen: WifiDirectStatus['state'][] = []
  wifi.on('status', (s) => seen.push(s.state))
  return seen
}

describe('WifiDirect', () => {
  it('starts off with the local address after init', async () => {
    const { exec } = fakeExec([])
    const wifi = new WifiDirect(exec, 0)
    await wifi.init()
    expect(wifi.status()).toMatchObject({ state: 'off', self: 'fc:b3:aa:bc:44:ff' })
  })

  it('is unsupported when iw fails', async () => {
    const wifi = new WifiDirect(async (cmd) => {
      if (cmd === 'iw') throw new Error('no iw')
      return ''
    }, 0)
    await wifi.init()
    expect(wifi.status().state).toBe('unsupported')
  })

  it('creates the profile with its IP and retries until the peer answers', async () => {
    const { exec, calls } = fakeExec([false, true])
    const wifi = new WifiDirect(exec, 0)
    await wifi.init()
    const seen = states(wifi)

    expect(await wifi.start('9c:97:1b:26:9f:18')).toBe(true)
    await wifi.stop()

    const add = calls.find((c) => c.args[1] === 'add')
    expect(add?.args).toEqual(expect.arrayContaining(['wifi-p2p.peer', '9c:97:1b:26:9f:18', 'ipv4.addresses', '10.42.99.2/24']))
    expect(calls.filter((c) => c.args.includes('up'))).toHaveLength(2)
    expect(seen).toEqual(['connecting', 'on', 'off'])
  })

  it('reports an error after every attempt fails', async () => {
    const { exec } = fakeExec([])
    const wifi = new WifiDirect(exec, 0)
    await wifi.init()
    expect(await wifi.start('9c:97:1b:26:9f:18')).toBe(false)
    expect(wifi.status().state).toBe('error')
  })

  it('stop cancels an ongoing start and removes the profile', async () => {
    let release: (ok: boolean) => void = () => undefined
    const calls: Call[] = []
    const wifi = new WifiDirect(async (cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'iw') return IW_DEV
      if (args.includes('up')) {
        const ok = await new Promise<boolean>((r) => (release = r))
        if (!ok) throw new Error('deactivated')
      }
      return ''
    }, 0)
    await wifi.init()
    const started = wifi.start('9c:97:1b:26:9f:18')
    await new Promise((r) => setTimeout(r, 0))
    const stopped = wifi.stop()
    release(false)
    expect(await started).toBe(false)
    await stopped
    expect(wifi.status().state).toBe('off')
    expect(calls.filter((c) => c.args.includes('up'))).toHaveLength(1)
    expect(calls.at(-1)?.args).toEqual(['connection', 'delete', P2P_CONNECTION])
  })

  it('refuses its own address', async () => {
    const { exec } = fakeExec([true])
    const wifi = new WifiDirect(exec, 0)
    await wifi.init()
    expect(await wifi.start('fc:b3:aa:bc:44:ff')).toBe(false)
    expect(wifi.status().state).toBe('off')
  })
})
