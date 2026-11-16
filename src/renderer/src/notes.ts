import { HIT_LEVELS, type HitLevel, type Note } from '../../shared/notes'

export type NoteFilter = 'all' | HitLevel

export const HIT_LABEL: Record<HitLevel, string> = { red: 'Vermelho', yellow: 'Amarelo', green: 'Verde' }

const fold = (text: string) => [...text].map((c) => c.normalize('NFD').charAt(0).toLowerCase()).join('')

export function matchRanges(text: string, query: string): [number, number][] {
  const needle = fold(query.trim())
  if (!needle) return []
  const chars = [...text]
  const hay = fold(text)
  const ranges: [number, number][] = []
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    ranges.push([at, at + needle.length])
  }
  return ranges.map(([a, b]) => [chars.slice(0, a).join('').length, chars.slice(0, b).join('').length])
}

export function splitMatches(text: string, query: string): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = []
  let last = 0
  for (const [a, b] of matchRanges(text, query)) {
    if (a > last) out.push({ text: text.slice(last, a), hit: false })
    out.push({ text: text.slice(a, b), hit: true })
    last = b
  }
  if (last < text.length || out.length === 0) out.push({ text: text.slice(last), hit: false })
  return out
}

export const noteBody = (note: Note) => (note.attachment ? `[anexo] ${note.attachment.name}` : note.text)

const matches = (note: Note, query: string) =>
  [noteBody(note), note.fromName, note.comment].some((field) => matchRanges(field, query).length > 0)

const rank = (note: Note) => (note.hit ? HIT_LEVELS.indexOf(note.hit) : HIT_LEVELS.length)

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => rank(a) - rank(b) || b.savedAt - a.savedAt)
}

export function filterNotes(notes: Note[], query: string, filter: NoteFilter): Note[] {
  return sortNotes(notes.filter((n) => (filter === 'all' || n.hit === filter) && (!query.trim() || matches(n, query))))
}

export function hitCounts(notes: Note[]): Record<HitLevel, number> {
  const counts: Record<HitLevel, number> = { red: 0, yellow: 0, green: 0 }
  for (const n of notes) if (n.hit) counts[n.hit]++
  return counts
}

export function parseHitArg(arg: string): HitLevel | null | undefined {
  const word = arg.trim().toLowerCase()
  if (!word) return null
  if (/^verm/.test(word)) return 'red'
  if (/^amar/.test(word)) return 'yellow'
  if (/^verd/.test(word)) return 'green'
  return undefined
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function noteDate(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} · ${time}`
}

export const preview = (text: string, max = 60) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

export function shortDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
