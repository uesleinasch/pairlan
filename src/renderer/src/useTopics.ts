import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChatMessage } from '../../shared/protocol'
import type { Topic, TopicDuration } from '../../shared/topics'
import { GENERAL, knownIds, lastByKey, messagesIn, unreadByKey } from './topics'

const api = window.pairlan

const SEEN_KEY = 'pairlan.seen'

type Seen = { base: number; at: Record<string, number> }

function loadSeen(): Seen {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as Seen | null
    if (raw && typeof raw.base === 'number' && typeof raw.at === 'object' && raw.at) return raw
  } catch {
    return { base: Date.now(), at: {} }
  }
  return { base: Date.now(), at: {} }
}

export function useTopics(messages: ChatMessage[], selfId: string, onRemoved: (id: string) => void) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [chosen, setActive] = useState(GENERAL)
  const [seen, setSeen] = useState(loadSeen)

  useEffect(() => {
    const offs = [api.onTopics(setTopics), api.onTopicRemoved(onRemoved)]
    return () => offs.forEach((off) => off())
  }, [onRemoved])

  const known = useMemo(() => knownIds(topics), [topics])
  const active = chosen && known.has(chosen) ? chosen : GENERAL
  const topic = topics.find((t) => t.id === active) ?? null
  const last = useMemo(() => lastByKey(messages, known), [messages, known])
  const visible = useMemo(() => messagesIn(messages, active, known), [messages, active, known])
  const unread = useMemo(() => unreadByKey(messages, seen.at, seen.base, selfId, known), [messages, seen, selfId, known])
  const lastActive = last.get(active)?.ts ?? 0

  useEffect(() => {
    api.setActiveTopic(active || null)
  }, [active])

  useEffect(() => {
    setSeen((prev) => {
      const next = { ...prev, at: { ...prev.at, [active]: Math.max(Date.now(), lastActive) } }
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      } catch {
        return next
      }
      return next
    })
  }, [active, lastActive])

  const create = useCallback(async (title: string, duration: TopicDuration | null) => {
    const created = await api.createTopic(title, duration)
    if (created) setActive(created.id)
    return created
  }, [])

  const unreadElsewhere = [...unread].reduce((sum, [key, n]) => (key === active ? sum : sum + n), 0)

  return { topics, setTopics, known, active, topic, setActive, last, visible, unread, unreadElsewhere, create }
}

export type TopicsApi = ReturnType<typeof useTopics>
