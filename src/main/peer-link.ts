import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import type { LinkStatus } from '../shared/api'
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

const HEARTBEAT_MS = 5000
const MAX_BACKOFF_MS = 10000

type Target = { address: string; port: number }

type Events = {
  status: [LinkStatus]
  message: [WireMessage]
}

export class PeerLink extends EventEmitter<Events> {
  private server: WebSocketServer | null = null
  private socket: WebSocket | null = null
  private pending: WebSocket | null = null
  private peer: PeerInfo | null = null
  private address: string | null = null
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
      server.on('connection', (ws, req) => this.adopt(ws, req.socket.remoteAddress ?? 'desconhecido'))
      this.server = server
    })
  }

  listeningPort(): number {
    const addr = this.server?.address()
    return typeof addr === 'object' && addr ? addr.port : this.port
  }

  status(): LinkStatus {
    if (this.peer && this.socket) return { state: 'connected', peer: this.peer, address: this.address }
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

  send(m: WireMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(encodeWire(m))
    return true
  }

  sendAsync(m: WireMessage): Promise<boolean> {
    const ws = this.socket
    if (ws?.readyState !== WebSocket.OPEN) return Promise.resolve(false)
    return new Promise((resolve) => ws.send(encodeWire(m), (err) => resolve(!err)))
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
      this.adopt(ws, target.address)
    })
    ws.once('error', () => undefined)
    ws.once('close', () => {
      if (this.pending !== ws) return
      this.pending = null
      this.scheduleRetry()
    })
  }

  private adopt(ws: WebSocket, address: string): void {
    if (this.socket) {
      ws.close(4000, 'busy')
      return
    }
    this.socket = ws
    this.address = address
    this.attempts = 0
    this.alive = true
    this.clearRetry()

    ws.on('pong', () => (this.alive = true))
    ws.on('message', (data) => this.receive(data.toString()))
    ws.on('error', () => undefined)
    ws.once('close', () => this.onClose(ws))

    this.heartbeat = setInterval(() => {
      if (!this.alive) {
        ws.terminate()
        return
      }
      this.alive = false
      ws.ping()
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

  private onClose(ws: WebSocket): void {
    if (this.socket !== ws) return
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
