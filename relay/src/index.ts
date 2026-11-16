import { DurableObject } from 'cloudflare:workers'
import {
  authMessage,
  deleteMessage,
  isPublicKey,
  normalizeUsername,
  registerMessage,
  RELAY_PING,
  RELAY_PONG,
  roomKey,
  type RelayControl,
  type RelayErrorReason,
  type RelayIceServer
} from '../../src/shared/relay'
import { FALLBACK_ICE, iceServersFrom, isFreshTimestamp, randomNonce, verifyEd25519 } from './logic'

export interface Env {
  USERS: DurableObjectNamespace<UserDO>
  ROOMS: DurableObjectNamespace<RoomDO>
  REGISTER_LIMITER: RateLimit
  PAIR_LIMITER: RateLimit
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
}

const TURN_TTL_SECONDS = 86400
const MAX_SOCKETS_PER_ROOM = 6

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

const control = (m: RelayControl): string => JSON.stringify(m)

const user = (env: Env, username: string) => env.USERS.get(env.USERS.idFromName(username))

const readJson = async (request: Request): Promise<Record<string, unknown>> => {
  const body = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

const limited = async (limiter: RateLimit, request: Request): Promise<boolean> =>
  !(await limiter.limit({ key: request.headers.get('cf-connecting-ip') ?? 'local' })).success

async function register(request: Request, env: Env): Promise<Response> {
  if (await limited(env.REGISTER_LIMITER, request)) return json({ error: 'rate' }, 429)
  const body = await readJson(request)
  const username = normalizeUsername(body.username)
  if (!username || !isPublicKey(body.publicKey) || typeof body.sig !== 'string') return json({ error: 'bad-request' }, 400)
  if (!(await verifyEd25519(body.publicKey, registerMessage(username, body.publicKey), body.sig))) {
    return json({ error: 'auth' }, 401)
  }
  const result = await user(env, username).claim(body.publicKey)
  if (result === 'taken') return json({ error: 'taken' }, 409)
  return json({ username }, result === 'created' ? 201 : 200)
}

async function release(request: Request, env: Env, username: string): Promise<Response> {
  if (await limited(env.REGISTER_LIMITER, request)) return json({ error: 'rate' }, 429)
  const body = await readJson(request)
  if (!isFreshTimestamp(body.ts, Date.now()) || typeof body.sig !== 'string') return json({ error: 'bad-request' }, 400)
  const stub = user(env, username)
  const key = await stub.publicKey()
  if (!key) return json({ error: 'not-found' }, 404)
  if (!(await verifyEd25519(key, deleteMessage(username, body.ts), body.sig))) return json({ error: 'auth' }, 401)
  await stub.release()
  return new Response(null, { status: 204 })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') return json({ ok: true })
    if (url.pathname === '/users' && request.method === 'POST') return register(request, env)

    const match = /^\/users\/([^/]+)$/.exec(url.pathname)
    if (match) {
      const username = normalizeUsername(decodeURIComponent(match[1]))
      if (!username) return json({ error: 'bad-request' }, 400)
      if (request.method === 'GET') {
        const publicKey = await user(env, username).publicKey()
        return publicKey ? json({ username, publicKey }) : json({ error: 'not-found' }, 404)
      }
      if (request.method === 'DELETE') return release(request, env, username)
      return json({ error: 'method' }, 405)
    }

    if (url.pathname === '/pair') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426)
      if (await limited(env.PAIR_LIMITER, request)) return json({ error: 'rate' }, 429)
      const me = normalizeUsername(url.searchParams.get('me'))
      const peer = normalizeUsername(url.searchParams.get('peer'))
      if (!me || !peer || me === peer) return json({ error: 'bad-request' }, 400)
      return env.ROOMS.get(env.ROOMS.idFromName(roomKey(me, peer))).fetch(request)
    }

    return json({ error: 'not-found' }, 404)
  }
} satisfies ExportedHandler<Env>

export class UserDO extends DurableObject<Env> {
  async publicKey(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('publicKey')) ?? null
  }

  async claim(publicKey: string): Promise<'created' | 'same' | 'taken'> {
    const current = await this.publicKey()
    if (current) return current === publicKey ? 'same' : 'taken'
    await this.ctx.storage.put('publicKey', publicKey)
    return 'created'
  }

  async release(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}

type SocketState = { me: string; peer: string; nonce: string; authed: boolean }

const closeQuietly = (ws: WebSocket, code?: number, reason?: string): void => {
  try {
    ws.close(code, reason)
  } catch {
    return
  }
}

const stateOf = (ws: WebSocket): SocketState | null => ws.deserializeAttachment() as SocketState | null

export class RoomDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(RELAY_PING, RELAY_PONG))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const me = normalizeUsername(url.searchParams.get('me'))
    const peer = normalizeUsername(url.searchParams.get('peer'))
    if (!me || !peer) return json({ error: 'bad-request' }, 400)
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) return json({ error: 'busy' }, 429)

    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server, [me])
    const nonce = randomNonce()
    server.serializeAttachment({ me, peer, nonce, authed: false } satisfies SocketState)
    server.send(control({ r: 'challenge', nonce }))
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const state = stateOf(ws)
    if (!state || typeof message !== 'string') return
    if (!state.authed) return this.authenticate(ws, state, message)
    this.partner(state)?.send(message)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    closeQuietly(ws)
    this.notifyGone(ws)
  }

  private notifyGone(ws: WebSocket): void {
    const state = stateOf(ws)
    if (!state?.authed) return
    const stillThere = this.ctx.getWebSockets(state.me).some((other) => other !== ws && stateOf(other)?.authed)
    if (!stillThere) this.partner(state)?.send(control({ r: 'peer', online: false }))
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  private async authenticate(ws: WebSocket, state: SocketState, message: string): Promise<void> {
    let sig: unknown
    try {
      sig = JSON.parse(message).sig
    } catch {
      sig = null
    }
    const key = await user(this.env, state.me).publicKey()
    if (!key) return this.reject(ws, 'unknown-user')
    const valid = typeof sig === 'string' && (await verifyEd25519(key, authMessage(state.nonce, state.me, state.peer), sig))
    if (!valid) return this.reject(ws, 'auth')

    for (const old of this.ctx.getWebSockets(state.me)) {
      if (old === ws) continue
      old.serializeAttachment({ ...stateOf(old)!, authed: false })
      this.reject(old, 'replaced')
    }
    ws.serializeAttachment({ ...state, authed: true } satisfies SocketState)
    ws.send(control({ r: 'ready', iceServers: await this.iceServers() }))

    const other = this.partner(state)
    if (!other) return
    other.send(control({ r: 'peer', online: true }))
    ws.send(control({ r: 'peer', online: true }))
  }

  private reject(ws: WebSocket, reason: RelayErrorReason): void {
    try {
      ws.send(control({ r: 'error', reason }))
    } catch {
      return closeQuietly(ws)
    }
    closeQuietly(ws, 4003, reason)
  }

  private partner(state: SocketState): WebSocket | null {
    for (const ws of this.ctx.getWebSockets(state.peer)) {
      const other = stateOf(ws)
      if (other?.authed && other.peer === state.me) return ws
    }
    return null
  }

  private async iceServers(): Promise<RelayIceServer[]> {
    const { TURN_KEY_ID: id, TURN_KEY_API_TOKEN: token } = this.env
    if (!id || !token) return FALLBACK_ICE
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS })
      })
      return res.ok ? iceServersFrom(await res.json()) : FALLBACK_ICE
    } catch {
      return FALLBACK_ICE
    }
  }
}
