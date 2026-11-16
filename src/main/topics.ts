import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ChatMessage } from '../shared/protocol'
import { cleanTitle, isTopic, isTopicDuration, isTopicId, MAX_TOPICS, TOPIC_DURATIONS, type Topic } from '../shared/topics'

const TOMBSTONE_MS = 90 * 24 * 60 * 60 * 1000

type Tombstone = { id: string; at: number }
type State = { topics: Topic[]; deleted: Tombstone[] }

export class TopicStore {
  private state: State | null = null

  constructor(
    private readonly file: string,
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = randomUUID
  ) {}

  list(): Topic[] {
    return this.load().topics
  }

  deletedIds(): string[] {
    return this.load().deleted.map((d) => d.id)
  }

  get(id: unknown): Topic | undefined {
    return this.list().find((t) => t.id === id)
  }

  create(title: unknown, duration: unknown, createdBy: string): Topic | null {
    const clean = cleanTitle(title)
    if (!clean || this.list().length >= MAX_TOPICS || (duration !== null && !isTopicDuration(duration))) return null
    const at = this.now()
    const topic: Topic = {
      id: this.newId(),
      title: clean,
      createdBy,
      createdAt: at,
      updatedAt: at,
      expiresAt: duration ? at + TOPIC_DURATIONS[duration] : null
    }
    this.save({ ...this.load(), topics: [...this.list(), topic] })
    return topic
  }

  rename(id: unknown, title: unknown): Topic | null {
    const clean = cleanTitle(title)
    return clean ? this.patch(id, { title: clean }) : null
  }

  setExpiry(id: unknown, duration: unknown): Topic | null {
    if (duration !== null && !isTopicDuration(duration)) return null
    return this.patch(id, { expiresAt: duration ? this.now() + TOPIC_DURATIONS[duration] : null })
  }

  upsert(topic: Topic): boolean {
    if (!isTopic(topic) || this.deletedIds().includes(topic.id)) return false
    const current = this.get(topic.id)
    if (current && current.updatedAt >= topic.updatedAt) return false
    if (!current && this.list().length >= MAX_TOPICS) return false
    const topics = current ? this.list().map((t) => (t.id === topic.id ? topic : t)) : [...this.list(), topic]
    this.save({ ...this.load(), topics })
    return true
  }

  remove(id: unknown): boolean {
    if (!isTopicId(id)) return false
    const had = this.list().some((t) => t.id === id)
    const deleted = this.load().deleted.some((d) => d.id === id) ? this.load().deleted : [...this.load().deleted, { id, at: this.now() }]
    this.save({ topics: this.list().filter((t) => t.id !== id), deleted })
    return had
  }

  sync(topics: Topic[], deleted: string[]): { changed: boolean; removed: string[] } {
    const removed = deleted.filter((id) => this.get(id))
    for (const id of deleted) this.remove(id)
    let changed = removed.length > 0
    for (const topic of topics) changed = this.upsert(topic) || changed
    return { changed, removed }
  }

  expired(): string[] {
    const at = this.now()
    return this.list()
      .filter((t) => t.expiresAt !== null && t.expiresAt <= at)
      .map((t) => t.id)
  }

  private patch(id: unknown, patch: Partial<Pick<Topic, 'title' | 'expiresAt'>>): Topic | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch, updatedAt: Math.max(this.now(), current.updatedAt + 1) }
    this.save({ ...this.load(), topics: this.list().map((t) => (t.id === current.id ? next : t)) })
    return next
  }

  private load(): State {
    if (this.state) return this.state
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(this.file, 'utf8'))
    } catch {
      raw = null
    }
    const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    const cutoff = this.now() - TOMBSTONE_MS
    const deleted = (Array.isArray(data.deleted) ? data.deleted : []).filter(
      (d): d is Tombstone => typeof d === 'object' && d !== null && isTopicId(d.id) && typeof d.at === 'number' && d.at > cutoff
    )
    const gone = new Set(deleted.map((d) => d.id))
    const seen = new Set<string>()
    const topics = (Array.isArray(data.topics) ? data.topics : []).filter((t): t is Topic => {
      if (!isTopic(t) || gone.has(t.id) || seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    this.state = { topics, deleted }
    return this.state
  }

  private save(next: State): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(next))
    renameSync(tmp, this.file)
    this.state = next
  }
}

const stamp = (ts: number) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const sizeOf = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

export function topicMarkdown(topic: Topic | null, messages: ChatMessage[], peerName: string, now: number): string {
  const lines = [`# ${topic ? topic.title : 'Geral'}`, '']
  const about = [`Conversa com ${peerName || 'o par'}`, `exportado em ${stamp(now)}`]
  if (topic) about.push(`criado em ${stamp(topic.createdAt)}`)
  if (topic?.expiresAt) about.push(`apaga em ${stamp(topic.expiresAt)}`)
  lines.push(`_${about.join(' · ')}_`, '')
  if (messages.length === 0) lines.push('(sem mensagens)', '')
  for (const m of messages) {
    lines.push(`**${m.fromName}** · ${stamp(m.ts)}`)
    lines.push(m.attachment ? `[anexo] ${m.attachment.name} (${sizeOf(m.attachment.size)})` : m.text, '')
  }
  return lines.join('\n')
}

export function exportFileName(topic: Topic | null, now: number): string {
  const slug =
    (topic ? topic.title : 'geral')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'topico'
  const d = new Date(now)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${slug}-${day}.md`
}
