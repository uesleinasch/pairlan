import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { HIT_LEVELS, MAX_COMMENT, type HitLevel, type Note } from '../../../shared/notes'
import { Highlight } from '../Highlight'
import { filterNotes, HIT_LABEL, hitCounts, noteBody, shortDate, type NoteFilter } from '../notes'

type Props = {
  notes: Note[]
  selfId: string
  initialQuery: string
  onClose: () => void
  onShow: (messageId: string) => void
  onHit: (id: string, hit: HitLevel | null) => void
  onComment: (id: string, comment: string) => void
  onRemove: (note: Note) => void
  onRestore: (note: Note) => void
  onCopy: (note: Note) => Promise<boolean>
}

const FILTERS: NoteFilter[] = ['all', ...HIT_LEVELS]
const LEVEL_KEYS: Record<string, HitLevel> = { '1': 'red', '2': 'yellow', '3': 'green' }

export function TermNotes(p: Props) {
  const [query, setQuery] = useState(p.initialQuery)
  const [filter, setFilter] = useState<NoteFilter>('all')
  const [cursor, setCursor] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<{ text: string; undo?: Note } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const shown = filterNotes(p.notes, query, filter)
  const at = Math.min(cursor, shown.length - 1)
  const current = at >= 0 ? shown[at] : undefined
  const counts = hitCounts(p.notes)
  const firstOther = shown.findIndex((n) => !n.hit)
  const hasHits = shown.some((n) => n.hit)

  useEffect(() => {
    listRef.current?.focus()
  }, [])

  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (current) document.getElementById(`tnote-${current.id}`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const focusList = () => listRef.current?.focus()

  const hit = (level: HitLevel | null) => {
    if (!current) return
    p.onHit(current.id, current.hit === level ? null : level)
  }

  const startEdit = () => {
    if (!current) return
    setDraft(current.comment)
    setEditing(current.id)
  }

  const finishEdit = (save: boolean) => {
    if (save && editing) p.onComment(editing, draft)
    setEditing(null)
    focusList()
  }

  const remove = () => {
    if (!current) return
    p.onRemove(current)
    setStatus({ text: 'nota apagada.', undo: current })
  }

  const undo = () => {
    if (!status?.undo) return
    p.onRestore(status.undo)
    setStatus({ text: 'nota de volta.' })
  }

  const copy = async () => {
    if (current) setStatus({ text: (await p.onCopy(current)) ? 'copiado.' : 'não deu para copiar.' })
  }

  const onListKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.target !== e.currentTarget && (e.key === 'Enter' || e.key === ' ')) return
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const actions: Record<string, () => void> = {
      ArrowDown: () => setCursor(Math.min(at + 1, shown.length - 1)),
      j: () => setCursor(Math.min(at + 1, shown.length - 1)),
      ArrowUp: () => setCursor(Math.max(at - 1, 0)),
      k: () => setCursor(Math.max(at - 1, 0)),
      Home: () => setCursor(0),
      End: () => setCursor(shown.length - 1),
      '0': () => hit(null),
      c: startEdit,
      d: remove,
      Delete: remove,
      u: undo,
      y: () => void copy(),
      f: () => setFilter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]),
      '/': () => searchRef.current?.focus(),
      Enter: () => current && p.onShow(current.messageId),
      Escape: p.onClose
    }
    const run = LEVEL_KEYS[key] ? () => hit(LEVEL_KEYS[key]) : actions[key]
    if (!run) return
    e.preventDefault()
    run()
  }

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(0)
      focusList()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      p.onClose()
    }
  }

  const onEditKey = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEdit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finishEdit(false)
    }
  }

  const link = (label: string, run: () => void, aria?: string) => (
    <button type="button" className="term-link" aria-label={aria} onClick={run}>
      {label}
    </button>
  )

  return (
    <div className="term-dialog-backdrop">
      <div className="term-dialog term-notes" role="dialog" aria-modal="true" aria-label="Notas">
        <span className="term-dialog-title">┤ notas ├</span>

        <label className="term-field">
          <span>buscar /</span>
          <input ref={searchRef} value={query} aria-label="Buscar nas notas" onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} />
          <span className="term-dim">
            {shown.length} de {p.notes.length}
          </span>
        </label>

        <p className="term-filters" role="group" aria-label="Filtrar por hit">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="term-opt"
              aria-pressed={filter === f}
              aria-label={f === 'all' ? 'todas' : `${HIT_LABEL[f].toLowerCase()} ${counts[f]}`}
              onClick={() => setFilter(f)}
            >
              {filter === f ? '[' : ' '}
              {f === 'all' ? 'todas' : <span className={`term-hit ${f}`}>●</span>}
              {f === 'all' ? '' : counts[f]}
              {filter === f ? ']' : ' '}
            </button>
          ))}
        </p>

        <div
          ref={listRef}
          className="term-note-list"
          role="listbox"
          tabIndex={0}
          aria-label="Notas"
          aria-activedescendant={current ? `tnote-${current.id}` : undefined}
          onKeyDown={onListKey}
        >
          {p.notes.length === 0 ? (
            <p className="term-dim">nenhuma nota. clique direito numa mensagem ou use /salvar.</p>
          ) : shown.length === 0 ? (
            <p className="term-dim">nada encontrado.</p>
          ) : (
            shown.map((n, i) => {
              const cur = i === at
              return (
                <div key={n.id}>
                  {i === 0 && hasHits && <p className="term-dim">─ hits</p>}
                  {i === firstOther && hasHits && <p className="term-dim">─ outras</p>}
                  <div
                    id={`tnote-${n.id}`}
                    role="option"
                    aria-selected={cur}
                    className={cur ? 'term-note cur' : 'term-note'}
                    onClick={() => {
                      setCursor(i)
                      if (editing !== n.id) focusList()
                    }}
                    onDoubleClick={() => p.onShow(n.messageId)}
                  >
                    <p>
                      <span className={n.hit ? `term-hit ${n.hit}` : 'term-dim'}>{n.hit ? '●' : '○'}</span> <span className="term-dim">{shortDate(n.ts)}</span>{' '}
                      <span className={n.from === p.selfId ? 'term-me' : 'term-peer'}>{n.fromName}</span>
                    </p>
                    <p className="term-note-text">
                      <Highlight text={noteBody(n)} query={query} />
                    </p>
                    {editing === n.id ? (
                      <label className="term-note-edit">
                        <span># </span>
                        <input ref={editRef} value={draft} maxLength={MAX_COMMENT} aria-label="Comentário" placeholder="comentário (enter salva, esc cancela)" onChange={(e) => setDraft(e.target.value)} onKeyDown={onEditKey} />
                      </label>
                    ) : (
                      n.comment && (
                        <p className="term-note-comment">
                          # <Highlight text={n.comment} query={query} />
                        </p>
                      )
                    )}
                    {cur && editing !== n.id && (
                      <p className="term-note-acts">
                        hit{' '}
                        {HIT_LEVELS.map((l) => (
                          <span key={l}>
                            <button type="button" className={`term-link term-hit ${l}`} aria-pressed={n.hit === l} aria-label={`Hit ${HIT_LABEL[l].toLowerCase()}`} onClick={() => hit(l)}>
                              ●
                            </button>{' '}
                          </span>
                        ))}
                        {link('○', () => hit(null), 'Sem hit')} · {link('comentar', startEdit)} · {link('copiar', () => void copy())} · {link('apagar', remove)} ·{' '}
                        {link('ver no chat', () => p.onShow(n.messageId))}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {status && (
          <p role="status">
            {status.text} {status.undo && link('desfazer (u)', undo)}
          </p>
        )}

        <pre className="term-pre term-dim">{'↑/↓ move · 1/2/3 hit · 0 tira hit · enter chat\nc comenta · d apaga · y copia · f filtro · / busca'}</pre>

        <div className="term-dialog-actions">
          <button type="button" className="term-act" onClick={p.onClose}>
            &lt; Fechar &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
