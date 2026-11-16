import type { ChatMessage } from '../../shared/protocol'
import { isTopicDuration, type Topic, type TopicDuration } from '../../shared/topics'

export const GENERAL = ''

export const keyOf = (m: ChatMessage, known: Set<string>) => (m.topic && known.has(m.topic) ? m.topic : GENERAL)

export const knownIds = (topics: Topic[]) => new Set(topics.map((t) => t.id))

export function messagesIn(messages: ChatMessage[], key: string, known: Set<string>): ChatMessage[] {
  return messages.filter((m) => keyOf(m, known) === key)
}

export function lastByKey(messages: ChatMessage[], known: Set<string>): Map<string, ChatMessage> {
  const last = new Map<string, ChatMessage>()
  for (const m of messages) last.set(keyOf(m, known), m)
  return last
}

export function unreadByKey(messages: ChatMessage[], seen: Record<string, number>, base: number, selfId: string, known: Set<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of messages) {
    if (m.from === selfId) continue
    const key = keyOf(m, known)
    if (m.ts > (seen[key] ?? base)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function sortByActivity(topics: Topic[], last: Map<string, ChatMessage>): Topic[] {
  const at = (t: Topic) => Math.max(t.createdAt, last.get(t.id)?.ts ?? 0)
  return [...topics].sort((a, b) => at(b) - at(a))
}

export function resolveTopic(arg: string, topics: Topic[]): string | null | undefined {
  const word = arg.trim().replace(/^#/, '').toLowerCase()
  if (/^\d+$/.test(word)) {
    const n = Number(word)
    if (n === 0) return null
    return topics[n - 1]?.id
  }
  if (word === 'geral') return null
  const exact = topics.find((t) => t.title.toLowerCase() === word)
  if (exact) return exact.id
  const prefix = topics.filter((t) => t.title.toLowerCase().startsWith(word))
  return prefix.length === 1 ? prefix[0].id : undefined
}

export function splitDuration(rest: string): { title: string; duration: TopicDuration | null } {
  const words = rest.trim().split(/\s+/).filter(Boolean)
  const last = words[words.length - 1]?.toLowerCase()
  if (last && isTopicDuration(last)) return { title: words.slice(0, -1).join(' '), duration: last }
  return { title: words.join(' '), duration: null }
}
