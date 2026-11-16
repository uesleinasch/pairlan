import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import type { LinkStatus, LinkVia } from '../shared/api'
import { encodeWire, parseWire, PROTOCOL_VERSION, type PeerInfo, type WireMessage } from '../shared/protocol'

export function isPrivateAddress(raw: string | undefined): boolean {
  if (!raw) return false
  const addr = raw.startsWith('::ffff:') ? raw.slice(7) : raw
  if (addr === '::1') return true
  if (isIP(addr) === 6) return /^(fe[89ab][0-9a-f]|f[cd][0-9a-f]{2}):/i.test(addr)
  if (isIP(addr) !== 4) return false
  const [a, b] = addr.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

const bareAddress = (a: string): string => (a.startsWith('::ffff:') ? a.slice(7) : a).toLowerCase()

export function iceMatchesPeer(candidate: string, peerAddress: string | null): boolean {
  if (!peerAddress) return true
  const address = candidate.split(' ')[4]
  if (!address || !isIP(address)) return true
  return bareAddress(address) === bareAddress(peerAddress)
}

const HEARTBEAT_MS = 5000
const MAX_BACKOFF_MS = 10000

type Target = { address: string; port: number }

export abstract class LinkChannel extends EventEmitter<{ message: [string]; close: []; pong: [] }> {
  abstract readonly open: boolean
  abstract send(text: string, cb?: (err?: Error) => void): void
  abstract ping(): void
  abstract close(code: number, reason: string): void
  abstract terminate(): void
}

class WsChannel extends LinkChannel {
  constructor(private readonly ws: WebSocket) {
    super()
    ws.on('message', (data) => this.emit('message', data.toString()))
    ws.on('pong', () => this.emit('pong'))
    ws.on('error', () => undefined)
    ws.once('close', () => this.emit('close'))
  }

  get open(): boolean {
    return this.ws.readyState === WebSocket.OPEN
  }

  send(text: string, cb?: (err?: Error) => void): void {
    this.ws.send(text, cb)
  }

  ping(): void {
    this.ws.ping()
  }

  close(code: number, reason: string): void {
    this.ws.close(code, reason)
  }

  terminate(): void {
    this.ws.terminate()
  }
}

type Events = {
  status: [LinkStatus]
  message: [WireMessage]
}

export class PeerLink extends EventEmitter<Events> {
  private server: WebSocketServer | null = null
  private socket: LinkChannel | null = null
  private pending: WebSocket | null = null
  private peer: PeerInfo | null = null
  private address: string | null = null
  private via: LinkVia = 'lan'
  private target: Target | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private heartbeat: NodeJS.Timeout | null = null
  private attempts = 0
  private alive = false

  constructor(
    private self: PeerInfo,
    private readonly port: number
  ) {
    super()
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({
        port: this.port,
        host: '0.0.0.0',
        verifyClient: ({ req }: { req: IncomingMessage }) => isPrivateAddress(req.socket.remoteAddress)
      })
      server.once('listening', () => resolve())
      server.once('error', reject)
      server.on('connection', (ws, req) => this.adopt(new WsChannel(ws), req.socket.remoteAddress ?? 'desconhecido', 'lan'))
      this.server = server
    })
  }

  listeningPort(): number {
    const addr = this.server?.address()
    return typeof addr === 'object' && addr ? addr.port : this.port
  }

  status(): LinkStatus {
    if (this.peer && this.socket) return { state: 'connected', peer: this.peer, address: this.address, via: this.via }
    if (this.pending || this.socket || this.retryTimer) return { state: 'connecting', peer: null, address: null }
    return { state: 'idle', peer: null, address: null }
  }

  isConnected(): boolean {
    return this.status().state === 'connected'
  }

  updateSelf(self: PeerInfo): void {
    this.self = self
    if (this.socket) this.send({ t: 'hello', v: PROTOCOL_VERSION, peer: self })
  }

  connectTo(address: string, port: number): void {
    this.target = { address, port }
    if (this.socket || this.pending) return
    this.clearRetry()
    this.dial()
  }

  moveTo(target: Target | null, keep: string | null): void {
    this.target = target
    this.attempts = 0
    this.clearRetry()
    const pending = this.pending
    this.pending = null
    pending?.terminate()
    const stays = this.socket && keep && this.address && bareAddress(this.address) === bareAddress(keep)
    if (this.socket && !stays) this.socket.terminate()
    else if (!this.socket && target) this.dial()
    this.emitStatus()
  }

  cancelDial(): void {
    this.target = null
    this.attempts = 0
    this.clearRetry()
    const pending = this.pending
    this.pending = null
    pending?.terminate()
    this.emitStatus()
  }

  attach(channel: LinkChannel): void {
    this.adopt(channel, null, 'internet')
  }

  send(m: WireMessage): boolean {
    if (!this.socket?.open) return false
    this.socket.send(encodeWire(m))
    return true
  }

  sendAsync(m: WireMessage): Promise<boolean> {
    const channel = this.socket
    if (!channel?.open) return Promise.resolve(false)
    return new Promise((resolve) => channel.send(encodeWire(m), (err) => resolve(!err)))
  }

  async stop(): Promise<void> {
    this.target = null
    this.clearRetry()
    this.pending?.terminate()
    this.socket?.terminate()
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
    this.server = null
  }

  private dial(): void {
    const target = this.target
    if (!target) return
    const host = isIP(target.address) === 6 ? `[${target.address}]` : target.address
    const ws = new WebSocket(`ws://${host}:${target.port}`, { handshakeTimeout: 4000 })
    this.pending = ws
    this.emitStatus()
    ws.once('open', () => {
      this.pending = null
      this.adopt(new WsChannel(ws), target.address, 'lan')
    })
    ws.once('error', () => undefined)
    ws.once('close', () => {
      if (this.pending !== ws) return
      this.pending = null
      this.scheduleRetry()
    })
  }

  private adopt(channel: LinkChannel, address: string | null, via: LinkVia): void {
    if (this.socket) {
      channel.close(4000, 'busy')
      return
    }
    this.socket = channel
    this.address = address
    this.via = via
    this.attempts = 0
    this.alive = true
    this.clearRetry()

    channel.on('pong', () => (this.alive = true))
    channel.on('message', (text) => this.receive(text))
    channel.once('close', () => this.onClose(channel))

    this.heartbeat = setInterval(() => {
      if (!this.alive) {
        channel.terminate()
        return
      }
      this.alive = false
      channel.ping()
    }, HEARTBEAT_MS)

    this.send({ t: 'hello', v: PROTOCOL_VERSION, peer: this.self })
    this.emitStatus()
  }

  private receive(raw: string): void {
    const m = parseWire(raw)
    if (!m) return
    if (m.t === 'hello') {
      if (m.v !== PROTOCOL_VERSION) {
        this.socket?.close(4001, 'version')
        return
      }
      this.peer = m.peer
      this.emitStatus()
      return
    }
    if (this.peer) this.emit('message', m)
  }

  private onClose(channel: LinkChannel): void {
    if (this.socket !== channel) return
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
    this.socket = null
    this.peer = null
    this.address = null
    this.scheduleRetry()
    this.emitStatus()
  }

  private scheduleRetry(): void {
    if (!this.target || this.retryTimer || this.socket || this.pending) {
      this.emitStatus()
      return
    }
    const delay = Math.min(500 * 2 ** this.attempts, MAX_BACKOFF_MS)
    this.attempts++
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.dial()
    }, delay)
    this.emitStatus()
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private emitStatus(): void {
    this.emit('status', this.status())
  }
}

export function parseAddress(input: string, defaultPort: number): { address: string; port: number } | null {
  const value = input.trim()
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(value)
  const plain = /^([^:]+)(?::(\d+))?$/.exec(value)
  const match = bracketed ?? plain
  const address = match ? match[1] : value
  const port = match?.[2] ? Number(match[2]) : defaultPort
  if (!isIP(address) || !isPrivateAddress(address) || port < 1 || port > 65535) return null
  return { address, port }
}
