export const PROTOCOL_VERSION = 1

export type PeerInfo = { id: string; name: string }

export const MAX_ATTACHMENT_BYTES = 500 * 1024 * 1024

export type Attachment = { name: string; size: number; mime: string }

export type ChatMessage = {
  id: string
  from: string
  fromName: string
  text: string
  ts: number
  attachment?: Attachment
}

export type IceCandidate = {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
}

export type ShareRole = 'sharer' | 'viewer'

export type MediaChannel = 'screen' | 'voice' | 'audio'

const MEDIA_CHANNELS: readonly MediaChannel[] = ['screen', 'voice', 'audio']

type SignalBase = { role: ShareRole; channel?: MediaChannel }

export type SignalPayload = SignalBase &
  (
    | { kind: 'offer'; sdp: string }
    | { kind: 'answer'; sdp: string }
    | { kind: 'ice'; candidate: IceCandidate }
    | { kind: 'stop' }
  )

export const channelOf = (p: SignalPayload): MediaChannel => p.channel ?? 'screen'

export type WireMessage =
  | { t: 'hello'; v: number; peer: PeerInfo }
  | { t: 'chat'; msg: ChatMessage }
  | { t: 'signal'; payload: SignalPayload }
  | { t: 'share-state'; sharing: boolean }
  | { t: 'typing' }
  | { t: 'presence'; liveAudio: boolean }
  | { t: 'file-start'; msg: ChatMessage & { attachment: Attachment } }
  | { t: 'file-chunk'; id: string; data: string }
  | { t: 'file-end'; id: string }
  | { t: 'laser'; x: number; y: number; click: boolean }
  | { t: 'laser-off' }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isString = (v: unknown): v is string => typeof v === 'string'

export const isUnit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

export function isPeerInfo(v: unknown): v is PeerInfo {
  return isObject(v) && isString(v.id) && v.id.length > 0 && isString(v.name)
}

export function isAttachment(v: unknown): v is Attachment {
  return (
    isObject(v) &&
    isString(v.name) &&
    v.name.length > 0 &&
    isString(v.mime) &&
    Number.isInteger(v.size) &&
    (v.size as number) >= 0 &&
    (v.size as number) <= MAX_ATTACHMENT_BYTES
  )
}

export function isChatMessage(v: unknown): v is ChatMessage {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.from) &&
    isString(v.fromName) &&
    isString(v.text) &&
    typeof v.ts === 'number' &&
    (v.attachment === undefined || isAttachment(v.attachment))
  )
}

function isSignal(v: unknown): v is SignalPayload {
  if (!isObject(v) || (v.role !== 'sharer' && v.role !== 'viewer')) return false
  if (v.channel !== undefined && !MEDIA_CHANNELS.includes(v.channel as MediaChannel)) return false
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
    case 'presence':
      return typeof data.liveAudio === 'boolean' ? { t: 'presence', liveAudio: data.liveAudio } : null
    case 'file-start':
      return isChatMessage(data.msg) && data.msg.attachment ? (data as WireMessage) : null
    case 'file-chunk':
      return isString(data.id) && isString(data.data) ? (data as WireMessage) : null
    case 'file-end':
      return isString(data.id) ? (data as WireMessage) : null
    case 'laser':
      return isUnit(data.x) && isUnit(data.y) && typeof data.click === 'boolean'
        ? { t: 'laser', x: data.x, y: data.y, click: data.click }
        : null
    case 'laser-off':
      return { t: 'laser-off' }
    default:
      return null
  }
}

export const encodeWire = (m: WireMessage): string => JSON.stringify(m)
