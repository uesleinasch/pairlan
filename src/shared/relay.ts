export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/^@/, '').toLowerCase()
  return USERNAME_PATTERN.test(name) ? name : null
}

export const isPublicKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export const registerMessage = (username: string, publicKey: string): string =>
  `pairlan-register-v1|${username}|${publicKey}`

export const deleteMessage = (username: string, ts: number): string => `pairlan-delete-v1|${username}|${ts}`

export const authMessage = (nonce: string, me: string, peer: string): string =>
  `pairlan-relay-v1|${nonce}|${me}|${peer}`

export const roomKey = (a: string, b: string): string => [a, b].sort().join('|')

export type RelayIceServer = { urls: string | string[]; username?: string; credential?: string }

export type RelayErrorReason = 'auth' | 'unknown-user' | 'replaced' | 'bad-request'

export type RelayControl =
  | { r: 'challenge'; nonce: string }
  | { r: 'ready'; iceServers: RelayIceServer[] }
  | { r: 'peer'; online: boolean }
  | { r: 'error'; reason: RelayErrorReason }

export const RELAY_PING = '{"r":"ping"}'
export const RELAY_PONG = '{"r":"pong"}'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isIceServer = (v: unknown): v is RelayIceServer =>
  isObject(v) &&
  (typeof v.urls === 'string' || (Array.isArray(v.urls) && v.urls.every((u) => typeof u === 'string'))) &&
  (v.username === undefined || typeof v.username === 'string') &&
  (v.credential === undefined || typeof v.credential === 'string')

export function parseRelayControl(raw: string): RelayControl | null {
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(v) || typeof v.r !== 'string') return null
  switch (v.r) {
    case 'challenge':
      return typeof v.nonce === 'string' ? { r: 'challenge', nonce: v.nonce } : null
    case 'ready':
      return Array.isArray(v.iceServers) ? { r: 'ready', iceServers: v.iceServers.filter(isIceServer) } : null
    case 'peer':
      return typeof v.online === 'boolean' ? { r: 'peer', online: v.online } : null
    case 'error':
      return typeof v.reason === 'string' ? { r: 'error', reason: v.reason as RelayErrorReason } : null
    default:
      return null
  }
}
