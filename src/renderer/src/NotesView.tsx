import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { HIT_LEVELS, MAX_COMMENT, type HitLevel, type Note } from '../../shared/notes'
import { Highlight } from './Highlight'
import { filterNotes, HIT_LABEL, hitCounts, noteBody, noteDate, type NoteFilter } from './notes'

type Props = {
  notes: Note[]
  onBack: () => void
  onShow: (messageId: string) => void
  onHit: (id: string, hit: HitLevel | null) => void
  onComment: (id: string, comment: string) => void
  onRemove: (note: Note) => void
  onCopy: (note: Note) => void
}

function Chip({ label, name, level, selected, onClick }: { label: string; name?: string; level?: HitLevel; selected: boolean; onClick: () => void }) {
  const ref = useRef<HTMLElement & { selected: boolean }>(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.selected = selected
  })
  return (
    <md-filter-chip
      ref={ref}
      label={label}
      aria-label={name}
      title={name}
      onClick={() => {
        if (ref.current) ref.current.selected = selected
        onClick()
      }}
    >
      {level && <span slot="icon" className={`chip-dot ${level}`} />}
    </md-filter-chip>
  )
}

type CardProps = Omit<Props, 'notes' | 'onBack'> & { note: Note; query: string }

function NoteCard({ note, query, onShow, onHit, onComment, onRemove, onCopy }: CardProps) {
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLElement>(null)

  useEffect(() => {
    if (editing) field.current?.focus()
  }, [editing])

  const pick = (hit: HitLevel | null) => {
    onHit(note.id, hit)
    setPicking(false)
  }

  const saveComment = () => {
    onComment(note.id, draft)
    setEditing(false)
  }

  const onFieldKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setEditing(false)
    } else if (e.key === 'Enter' && e.ctrlKey) saveComment()
  }

  const level = note.hit ? HIT_LABEL[note.hit].toLowerCase() : ''

  return (
    <article className="note-card">
      <div className="note-meta type-body-small">
        <strong>{note.fromName}</strong>
        <span>{noteDate(note.ts)}</span>
        <span className="grow" />
        {picking ? (
          <span className="hit-picker" role="group" aria-label="Escolher hit">
            {HIT_LEVELS.map((l) => (
              <button key={l} type="button" className={`hit-dot ${l}`} aria-pressed={note.hit === l} aria-label={`Hit ${HIT_LABEL[l].toLowerCase()}`} title={HIT_LABEL[l]} onClick={() => pick(l)}>
                <span />
              </button>
            ))}
            <button type="button" className="hit-dot none" aria-pressed={note.hit === null} aria-label="Sem hit" title="Sem hit" onClick={() => pick(null)}>
              <span />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={`hit-dot ${note.hit ?? 'none'}`}
            aria-label={note.hit ? `Hit ${level}. Trocar` : 'Sem hit. Escolher cor'}
            title={note.hit ? `Hit ${level}` : 'Marcar como hit'}
            onClick={() => setPicking(true)}
          >
            <span />
          </button>
        )}
      </div>
      <p className="note-text type-body-medium">
        <Highlight text={noteBody(note)} query={query} />
      </p>
      {editing ? (
        <div className="note-comment-edit">
          <md-outlined-text-field
            ref={field}
            type="textarea"
            rows={2}
            label="Comentário"
            maxLength={MAX_COMMENT}
            value={draft}
            oninput={(e: Event) => setDraft((e.target as HTMLTextAreaElement).value)}
            onKeyDown={onFieldKey}
          />
          <div className="note-actions">
            <md-text-button onClick={() => setEditing(false)}>Cancelar</md-text-button>
            <md-text-button onClick={saveComment}>Salvar</md-text-button>
          </div>
        </div>
      ) : (
        note.comment && (
          <p className="note-comment type-body-small">
            <Highlight text={note.comment} query={query} />
          </p>
        )
      )}
      {!editing && (
        <div className="note-actions">
          <md-text-button onClick={() => onShow(note.messageId)}>Ver no chat</md-text-button>
          <md-text-button
            onClick={() => {
              setDraft(note.comment)
              setEditing(true)
            }}
          >
            {note.comment ? 'Editar comentário' : 'Comentar'}
          </md-text-button>
          <md-icon-button aria-label="Copiar texto" title="Copiar texto" onClick={() => onCopy(note)}>
            <md-icon>content_copy</md-icon>
          </md-icon-button>
          <md-icon-button aria-label="Apagar nota" title="Apagar nota" onClick={() => onRemove(note)}>
            <md-icon>delete</md-icon>
          </md-icon-button>
        </div>
      )}
    </article>
  )
}

export function NotesView({ notes, onBack, ...card }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<NoteFilter>('all')
  const search = useRef<HTMLElement>(null)

  useEffect(() => {
    search.current?.focus()
  }, [])

  const counts = hitCounts(notes)
  const shown = filterNotes(notes, query, filter)
  const hits = shown.filter((n) => n.hit)
  const rest = shown.filter((n) => !n.hit)
  const total = notes.length

  const section = (title: string | null, list: Note[]) =>
    list.length > 0 && (
      <>
        {title && <h2 className="notes-section type-title-small">{title}</h2>}
        {list.map((n) => (
          <NoteCard key={n.id} note={n} query={query} {...card} />
        ))}
      </>
    )

  return (
    <section
      className="notes-view"
      aria-label="Notas"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onBack()
      }}
    >
      <header className="top-app-bar">
        <md-icon-button onClick={onBack} aria-label="Voltar ao chat" title="Voltar ao chat (Esc)">
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <div className="top-app-bar-text">
          <h1 className="type-title-large">Notas</h1>
          <p className="type-body-small">{total === 1 ? '1 salva' : `${total} salvas`} · só neste PC</p>
        </div>
      </header>
      <div className="notes-tools">
        <md-outlined-text-field
          ref={search}
          type="search"
          placeholder="Buscar nas notas e comentários"
          aria-label="Buscar nas notas e comentários"
          value={query}
          oninput={(e: Event) => setQuery((e.target as HTMLInputElement).value)}
        >
          <md-icon slot="leading-icon">search</md-icon>
        </md-outlined-text-field>
        <md-chip-set aria-label="Filtrar por hit">
          <Chip label={`Todas ${total}`} selected={filter === 'all'} onClick={() => setFilter('all')} />
          {HIT_LEVELS.map((l) => (
            <Chip key={l} label={String(counts[l])} name={`${HIT_LABEL[l]}: ${counts[l]}`} level={l} selected={filter === l} onClick={() => setFilter(filter === l ? 'all' : l)} />
          ))}
        </md-chip-set>
      </div>
      <div className="notes-list">
        {total === 0 ? (
          <div className="empty-state">
            <md-icon aria-hidden="true">bookmarks</md-icon>
            <p className="type-title-small">Nenhuma nota ainda</p>
            <p className="type-body-medium">Clique com o botão direito numa mensagem e escolha Salvar nas notas.</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="notes-none type-body-medium">Nada encontrado.</p>
        ) : (
          <>
            {section('Hits', hits)}
            {section(hits.length ? 'Outras' : null, rest)}
          </>
        )}
      </div>
    </section>
  )
}
