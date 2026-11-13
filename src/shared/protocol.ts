export const PROTOCOL_VERSION = 1

export type PeerInfo = { id: string; name: string }

export type ChatMessage = {
  id: string
  from: string
  fromName: string
  text: string
  ts: number
}

export type IceCandidate = {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
}

export type ShareRole = 'sharer' | 'viewer'

export type SignalPayload =
  | { role: ShareRole; kind: 'offer'; sdp: string }
  | { role: ShareRole; kind: 'answer'; sdp: string }
  | { role: ShareRole; kind: 'ice'; candidate: IceCandidate }
  | { role: ShareRole; kind: 'stop' }

export type WireMessage =
  | { t: 'hello'; v: number; peer: PeerInfo }
  | { t: 'chat'; msg: ChatMessage }
  | { t: 'signal'; payload: SignalPayload }
  | { t: 'share-state'; sharing: boolean }
  | { t: 'typing' }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isString = (v: unknown): v is string => typeof v === 'string'

export function isPeerInfo(v: unknown): v is PeerInfo {
  return isObject(v) && isString(v.id) && v.id.length > 0 && isString(v.name)
}

export function isChatMessage(v: unknown): v is ChatMessage {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.from) &&
    isString(v.fromName) &&
    isString(v.text) &&
    typeof v.ts === 'number'
  )
}

function isSignal(v: unknown): v is SignalPayload {
  if (!isObject(v) || (v.role !== 'sharer' && v.role !== 'viewer')) return false
  switch (v.kind) {
    case 'offer':
    case 'answer':
      return isString(v.sdp)
    case 'ice':
      return isObject(v.candidate) && isString(v.candidate.candidate)
    case 'stop':
      return true
    default:
      return false
  }
}

export function parseWire(raw: string): WireMessage | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(data)) return null
  switch (data.t) {
    case 'hello':
      return typeof data.v === 'number' && isPeerInfo(data.peer) ? (data as WireMessage) : null
    case 'chat':
      return isChatMessage(data.msg) ? (data as WireMessage) : null
    case 'signal':
      return isSignal(data.payload) ? (data as WireMessage) : null
    case 'share-state':
      return typeof data.sharing === 'boolean' ? (data as WireMessage) : null
    case 'typing':
      return { t: 'typing' }
    default:
      return null
  }
}

export const encodeWire = (m: WireMessage): string => JSON.stringify(m)
