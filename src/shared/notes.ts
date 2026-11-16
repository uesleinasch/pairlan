import { isAttachment, type Attachment, type ChatMessage } from './protocol'
import { isTopicId } from './topics'

export type HitLevel = 'red' | 'yellow' | 'green'

export const HIT_LEVELS: HitLevel[] = ['red', 'yellow', 'green']

export const MAX_COMMENT = 1000

export type Note = {
  id: string
  messageId: string
  from: string
  fromName: string
  text: string
  ts: number
  attachment?: Attachment
  topic?: string
  savedAt: number
  hit: HitLevel | null
  comment: string
}

export const isHitLevel = (v: unknown): v is HitLevel => typeof v === 'string' && (HIT_LEVELS as string[]).includes(v)

const isString = (v: unknown): v is string => typeof v === 'string'
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isNote(v: unknown): v is Note {
  if (typeof v !== 'object' || v === null) return false
  const n = v as Record<string, unknown>
  return (
    isString(n.id) &&
    n.id.length > 0 &&
    isString(n.messageId) &&
    isString(n.from) &&
    isString(n.fromName) &&
    isString(n.text) &&
    isTime(n.ts) &&
    isTime(n.savedAt) &&
    (n.hit === null || isHitLevel(n.hit)) &&
    isString(n.comment) &&
    n.comment.length <= MAX_COMMENT &&
    (n.attachment === undefined || isAttachment(n.attachment)) &&
    (n.topic === undefined || isTopicId(n.topic))
  )
}

export function noteFromMessage(msg: ChatMessage, id: string, savedAt: number, hit: HitLevel | null): Note {
  const note: Note = {
    id,
    messageId: msg.id,
    from: msg.from,
    fromName: msg.fromName,
    text: msg.text,
    ts: msg.ts,
    savedAt,
    hit,
    comment: ''
  }
  if (msg.attachment) note.attachment = { ...msg.attachment }
  if (msg.topic) note.topic = msg.topic
  return note
}
