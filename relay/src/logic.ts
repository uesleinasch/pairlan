import type { RelayIceServer } from '../../src/shared/relay'

export const FALLBACK_ICE: RelayIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]

const fromBase64Url = (value: string): Uint8Array => {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const randomNonce = (): string => toBase64Url(crypto.getRandomValues(new Uint8Array(24)))

export async function verifyEd25519(publicKey: string, message: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', fromBase64Url(publicKey), { name: 'Ed25519' }, false, ['verify'])
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, fromBase64Url(signature), new TextEncoder().encode(message))
  } catch {
    return false
  }
}

const usableUrl = (url: unknown): url is string => typeof url === 'string' && !/:53(\?|$)/.test(url)

export function iceServersFrom(body: unknown): RelayIceServer[] {
  const list = (body as { iceServers?: unknown })?.iceServers
  if (!Array.isArray(list)) return FALLBACK_ICE
  const servers = list.flatMap((entry): RelayIceServer[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const { urls, username, credential } = entry as Record<string, unknown>
    const kept = (Array.isArray(urls) ? urls : [urls]).filter(usableUrl)
    if (!kept.length) return []
    return [
      {
        urls: kept,
        ...(typeof username === 'string' ? { username } : {}),
        ...(typeof credential === 'string' ? { credential } : {})
      }
    ]
  })
  return servers.length ? servers : FALLBACK_ICE
}

export const isFreshTimestamp = (ts: unknown, now: number, windowMs = 5 * 60 * 1000): ts is number =>
  typeof ts === 'number' && Number.isFinite(ts) && Math.abs(now - ts) <= windowMs
