import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isHitLevel, isNote, MAX_COMMENT, noteFromMessage, type HitLevel, type Note } from '../shared/notes'
import { isChatMessage } from '../shared/protocol'

export const MAX_NOTES = 5000

export class NoteStore {
  private notes: Note[] | null = null

  constructor(
    private readonly file: string,
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = randomUUID
  ) {}

  list(): Note[] {
    if (this.notes) return this.notes
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.file, 'utf8'))
    } catch {
      parsed = []
    }
    const seen = new Set<string>()
    this.notes = (Array.isArray(parsed) ? parsed : []).filter((n): n is Note => {
      if (!isNote(n) || seen.has(n.id)) return false
      seen.add(n.id)
      return true
    })
    return this.notes
  }

  save(msg: unknown, hit: unknown = null): Note[] {
    if (!isChatMessage(msg) || (hit !== null && !isHitLevel(hit))) return this.list()
    const existing = this.list().find((n) => n.messageId === msg.id)
    if (existing) return hit ? this.update(existing.id, { hit }) : this.list()
    if (this.list().length >= MAX_NOTES) return this.list()
    return this.write([...this.list(), noteFromMessage(msg, this.newId(), this.now(), hit)])
  }

  setHit(id: unknown, hit: unknown): Note[] {
    if (hit !== null && !isHitLevel(hit)) return this.list()
    return this.update(id, { hit: hit as HitLevel | null })
  }

  setComment(id: unknown, comment: unknown): Note[] {
    if (typeof comment !== 'string') return this.list()
    return this.update(id, { comment: comment.trim().slice(0, MAX_COMMENT) })
  }

  remove(id: unknown): Note[] {
    const next = this.list().filter((n) => n.id !== id)
    return next.length === this.list().length ? this.list() : this.write(next)
  }

  restore(note: unknown): Note[] {
    if (!isNote(note) || this.list().some((n) => n.id === note.id || n.messageId === note.messageId)) return this.list()
    return this.write([...this.list(), note])
  }

  private update(id: unknown, patch: Partial<Pick<Note, 'hit' | 'comment'>>): Note[] {
    if (!this.list().some((n) => n.id === id)) return this.list()
    return this.write(this.list().map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  private write(next: Note[]): Note[] {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(next))
    renameSync(tmp, this.file)
    this.notes = next
    return next
  }
}
