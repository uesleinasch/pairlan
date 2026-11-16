export type Topic = {
  id: string
  title: string
  createdBy: string
  createdAt: number
  updatedAt: number
  expiresAt: number | null
}

export const MAX_TOPIC_TITLE = 40
export const MAX_TOPICS = 200

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const TOPIC_DURATIONS = { '1h': HOUR, '1d': DAY, '7d': 7 * DAY, '30d': 30 * DAY } as const

export type TopicDuration = keyof typeof TOPIC_DURATIONS

export const DURATION_LABEL: Record<TopicDuration, string> = { '1h': '1 hora', '1d': '1 dia', '7d': '7 dias', '30d': '30 dias' }

export const isTopicDuration = (v: unknown): v is TopicDuration => typeof v === 'string' && v in TOPIC_DURATIONS

export const isTopicId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)

export function cleanTitle(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const title = v.replace(/\s+/g, ' ').trim().replace(/^#+\s*/, '').slice(0, MAX_TOPIC_TITLE).trim()
  return title || null
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

export function isTopic(v: unknown): v is Topic {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return (
    isTopicId(t.id) &&
    typeof t.title === 'string' &&
    cleanTitle(t.title) === t.title &&
    typeof t.createdBy === 'string' &&
    isTime(t.createdAt) &&
    isTime(t.updatedAt) &&
    (t.expiresAt === null || isTime(t.expiresAt))
  )
}

export function expiresIn(expiresAt: number, now = Date.now()): string {
  const left = expiresAt - now
  if (left <= 0) return 'agora'
  if (left < HOUR) return `${Math.max(1, Math.round(left / 60000))} min`
  if (left < DAY) {
    const hours = Math.round(left / HOUR)
    return hours === 1 ? '1 hora' : `${hours} horas`
  }
  const days = Math.round(left / DAY)
  return days === 1 ? '1 dia' : `${days} dias`
}
