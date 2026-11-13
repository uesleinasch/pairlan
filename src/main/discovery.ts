import dgram from 'node:dgram'
import { EventEmitter } from 'node:events'
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'
import { PROTOCOL_VERSION } from '../shared/protocol'

export type Beacon = { app: 'pairlan'; v: number; id: string; name: string; linkPort: number }

export type DiscoveredPeer = Beacon & { address: string }

export const encodeBeacon = (b: Beacon): Buffer => Buffer.from(JSON.stringify(b))

export function parseBeacon(buf: Buffer): Beacon | null {
  try {
    const b = JSON.parse(buf.toString('utf8'))
    if (
      b?.app === 'pairlan' &&
      b.v === PROTOCOL_VERSION &&
      typeof b.id === 'string' &&
      b.id &&
      typeof b.name === 'string' &&
      Number.isInteger(b.linkPort) &&
      b.linkPort > 0 &&
      b.linkPort < 65536
    ) {
      return { app: 'pairlan', v: b.v, id: b.id, name: b.name, linkPort: b.linkPort }
    }
  } catch {
    return null
  }
  return null
}

const ipToInt = (ip: string): number =>
  ip.split('.').reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0)

const intToIp = (n: number): string => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')

export function broadcastAddresses(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): string[] {
  const out = new Set<string>()
  for (const list of Object.values(ifaces)) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      out.add(intToIp((ipToInt(info.address) | ~ipToInt(info.netmask)) >>> 0))
    }
  }
  out.add('255.255.255.255')
  return [...out]
}

export const shouldInitiate = (selfId: string, peerId: string): boolean => selfId < peerId

type DiscoveryOptions = {
  port: number
  intervalMs?: number
  beacon: () => Beacon
}

export class Discovery extends EventEmitter<{ peer: [DiscoveredPeer] }> {
  private socket: dgram.Socket | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly opts: DiscoveryOptions) {
    super()
  }

  start(): void {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket
    socket.on('error', (err) => console.warn('[discovery]', err.message))
    socket.on('message', (buf, rinfo) => {
      const beacon = parseBeacon(buf)
      if (!beacon || beacon.id === this.opts.beacon().id) return
      this.emit('peer', { ...beacon, address: rinfo.address })
    })
    socket.bind(this.opts.port, () => {
      socket.setBroadcast(true)
      this.announce()
      this.timer = setInterval(() => this.announce(), this.opts.intervalMs ?? 2000)
    })
  }

  announce(): void {
    const socket = this.socket
    if (!socket) return
    const payload = encodeBeacon(this.opts.beacon())
    for (const addr of broadcastAddresses()) {
      socket.send(payload, this.opts.port, addr, () => undefined)
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.socket?.close()
    this.socket = null
  }
}
