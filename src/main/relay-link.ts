import { EventEmitter } from 'node:events'
import { WebSocket } from 'ws'
import type { ActionResult, InternetState } from '../shared/api'
import {
  authMessage,
  deleteMessage,
  parseRelayControl,
  registerMessage,
  relayEndpoint,
  RELAY_PING,
  RELAY_PONG,
  isPublicKey,
  type RelayControl,
  type RelayErrorReason,
  type RelayIceServer
} from '../shared/relay'
import type { Identity } from './identity'
import { LinkChannel } from './peer-link'
import { createHandshake, isHandshakeFrame, type FrameCipher, type Handshake } from './secure-channel'

const MAX_BACKOFF_MS = 30000

const RELAY_ERRORS: Record<RelayErrorReason, string> = {
  auth: 'O servidor recusou sua chave. Registre o usuário de novo.',
  'unknown-user': 'Seu usuário não existe neste servidor. Registre de novo.',
  replaced: 'Seu usuário entrou em outro lugar.',
  'bad-request': 'Pedido inválido para o servidor.'
}

export const OFFLINE_ERROR = 'Servidor fora do ar ou endereço errado.'

export type RelayTarget = { url: string; me: string; peer: string; peerPublicKey: string }

export type RelayStatus = { state: InternetState; error: string | null }

class RelayChannel extends LinkChannel {
  open = true

  constructor(
    private readonly ws: WebSocket,
    private readonly cipher: FrameCipher,
    private readonly drop: () => void
  ) {
    super()
  }

  deliver(raw: string): void {
    const text = this.cipher.open(raw)
    if (text === null) this.terminate()
    else this.emit('message', text)
  }

  send(text: string, cb?: (err?: Error) => void): void {
    if (!this.open) return cb?.(new Error('closed'))
    this.ws.send(this.cipher.seal(text), cb)
  }

  ping(): void {
    if (this.open) this.ws.send(RELAY_PING)
  }

  close(): void {
    this.terminate()
  }

  terminate(): void {
    if (!this.end()) return
    this.drop()
  }

  end(): boolean {
    if (!this.open) return false
    this.open = false
    this.emit('close')
    return true
  }
}

type Events = {
  status: [RelayStatus]
  ice: [RelayIceServer[]]
  channel: [LinkChannel]
}

export class RelayDialer extends EventEmitter<Events> {
  private target: RelayTarget | null = null
  private ws: WebSocket | null = null
  private handshake: Handshake | null = null
  private channel: RelayChannel | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private attempts = 0
  private paused = false
  private current: RelayStatus = { state: 'off', error: null }

  constructor(private readonly identity: Identity) {
    super()
  }

  status(): RelayStatus {
    return { ...this.current }
  }

  configure(target: RelayTarget | null): void {
    this.target = target
    this.attempts = 0
    this.disconnect()
    this.current = { state: 'off', error: null }
    this.connect()
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.disconnect()
    this.setStatus('off', null)
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.attempts = 0
    this.connect()
  }

  stop(): void {
    this.target = null
    this.disconnect()
    this.setStatus('off', null)
  }

  private connect(): void {
    this.clearRetry()
    if (!this.target || this.paused) return this.setStatus('off', null)
    if (this.ws) return
    const { url, me, peer } = this.target
    const query = `/pair?me=${encodeURIComponent(me)}&peer=${encodeURIComponent(peer)}`
    const ws = new WebSocket(relayEndpoint(url, query, true), { handshakeTimeout: 8000 })
    this.ws = ws
    this.setStatus('connecting', this.current.error)
    ws.on('message', (data) => this.onFrame(ws, data.toString()))
    ws.on('error', () => undefined)
    ws.once('close', () => this.onClosed(ws))
  }

  private onFrame(ws: WebSocket, raw: string): void {
    if (ws !== this.ws) return
    if (raw === RELAY_PONG) return void this.channel?.emit('pong')
    const control = parseRelayControl(raw)
    if (control) return this.onControl(ws, control)
    if (isHandshakeFrame(raw)) return this.onHello(ws, raw)
    this.channel?.deliver(raw)
  }

  private onControl(ws: WebSocket, control: RelayControl): void {
    const target = this.target
    if (!target) return
    switch (control.r) {
      case 'challenge':
        ws.send(JSON.stringify({ sig: this.identity.sign(authMessage(control.nonce, target.me, target.peer)) }))
        break
      case 'ready':
        this.attempts = 0
        this.emit('ice', control.iceServers)
        this.setStatus('waiting-peer', null)
        break
      case 'peer':
        if (control.online) this.startHandshake(ws)
        else {
          this.endChannel()
          this.setStatus('waiting-peer', null)
        }
        break
      case 'error':
        this.setStatus('error', RELAY_ERRORS[control.reason] ?? RELAY_ERRORS['bad-request'])
        break
    }
  }

  private startHandshake(ws: WebSocket): void {
    const target = this.target
    if (!target) return
    this.endChannel()
    this.handshake = createHandshake(this.identity, target.me, target.peer, target.peerPublicKey)
    this.setStatus('securing', null)
    ws.send(this.handshake.hello)
  }

  private onHello(ws: WebSocket, raw: string): void {
    if (!this.handshake) this.startHandshake(ws)
    const cipher = this.handshake?.accept(raw) ?? null
    this.handshake = null
    if (!cipher) {
      this.setStatus('error', 'A chave do par não confere. Remova e adicione o par de novo, e confira o código.')
      ws.close(1000)
      return
    }
    const channel = new RelayChannel(ws, cipher, () => ws.close(1000))
    this.channel = channel
    this.setStatus('connected', null)
    this.emit('channel', channel)
  }

  private onClosed(ws: WebSocket): void {
    if (ws !== this.ws) return
    this.ws = null
    this.handshake = null
    this.endChannel()
    this.scheduleRetry()
  }

  private scheduleRetry(): void {
    if (!this.target || this.paused || this.retryTimer) return
    const delay = Math.min(1000 * 2 ** this.attempts, MAX_BACKOFF_MS)
    this.attempts++
    const error = this.current.state === 'error' ? this.current.error : this.attempts > 2 ? OFFLINE_ERROR : null
    this.setStatus(error ? 'error' : 'connecting', error)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  private disconnect(): void {
    this.clearRetry()
    const ws = this.ws
    this.ws = null
    this.handshake = null
    this.endChannel()
    ws?.close(1000)
  }

  private endChannel(): void {
    const channel = this.channel
    this.channel = null
    channel?.end()
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private setStatus(state: InternetState, error: string | null): void {
    if (this.current.state === state && this.current.error === error) return
    this.current = { state, error }
    this.emit('status', this.status())
  }
}

const HTTP_ERRORS: Record<number, string> = {
  400: 'Nome inválido. Use 3 a 20 letras minúsculas, números ou _.',
  401: 'O servidor recusou a assinatura.',
  404: 'Usuário não encontrado neste servidor.',
  409: 'Esse nome já está em uso. Escolha outro.',
  429: 'Muitas tentativas. Espere um minuto.'
}

async function call(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10000) })
  } catch {
    return null
  }
}

const failure = (res: Response | null): ActionResult => ({
  ok: false,
  error: res ? (HTTP_ERRORS[res.status] ?? `Erro do servidor (${res.status}).`) : OFFLINE_ERROR
})

export async function registerUser(base: string, identity: Identity, username: string): Promise<ActionResult> {
  const res = await call(relayEndpoint(base, '/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      publicKey: identity.publicKey,
      sig: identity.sign(registerMessage(username, identity.publicKey))
    })
  })
  return res?.ok ? { ok: true } : failure(res)
}

export async function releaseUser(base: string, identity: Identity, username: string): Promise<ActionResult> {
  const ts = Date.now()
  const res = await call(relayEndpoint(base, `/users/${encodeURIComponent(username)}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ts, sig: identity.sign(deleteMessage(username, ts)) })
  })
  return res?.ok ? { ok: true } : failure(res)
}

export async function lookupUser(
  base: string,
  username: string
): Promise<{ ok: true; publicKey: string } | { ok: false; error: string }> {
  const res = await call(relayEndpoint(base, `/users/${encodeURIComponent(username)}`))
  if (!res?.ok) return failure(res) as { ok: false; error: string }
  const body = (await res.json().catch(() => null)) as { publicKey?: unknown } | null
  return isPublicKey(body?.publicKey) ? { ok: true, publicKey: body.publicKey } : { ok: false, error: 'Resposta inválida do servidor.' }
}
