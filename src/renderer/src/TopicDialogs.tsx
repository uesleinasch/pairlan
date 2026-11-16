import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cleanTitle, DURATION_LABEL, MAX_TOPIC_TITLE, TOPIC_DURATIONS, type Topic, type TopicDuration } from '../../shared/topics'

export type TopicDialogMode = { kind: 'create' } | { kind: 'rename' | 'expiry'; topic: Topic }

const DURATIONS = Object.keys(TOPIC_DURATIONS) as TopicDuration[]

const stamp = (ts: number) =>
  new Date(ts).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ', às')

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const ref = useRef<HTMLElement & { selected: boolean }>(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.selected = selected
  })
  return (
    <md-filter-chip
      ref={ref}
      label={label}
      onClick={() => {
        if (ref.current) ref.current.selected = selected
        onClick()
      }}
    />
  )
}

type Props = {
  mode: TopicDialogMode | null
  onClose: () => void
  onSubmit: (title: string, duration: TopicDuration | null) => void
}

export function TopicDialog({ mode, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [temporary, setTemporary] = useState(false)
  const [duration, setDuration] = useState<TopicDuration>('7d')
  const field = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!mode) return
    setTitle(mode.kind === 'create' ? '' : mode.topic.title)
    setTemporary(mode.kind === 'expiry' ? mode.topic.expiresAt !== null : false)
    setDuration('7d')
    window.setTimeout(() => field.current?.focus(), 50)
  }, [mode])

  const kind = mode?.kind ?? 'create'
  const valid = kind === 'expiry' || cleanTitle(title) !== null
  const submit = () => {
    if (!valid) return
    onSubmit(title, temporary ? duration : null)
    onClose()
  }
  const current = mode?.kind === 'expiry' ? mode.topic.expiresAt : null

  return (
    <md-dialog open={mode !== null} onclosed={onClose} className="topic-dialog">
      <span slot="headline">{kind === 'create' ? 'Novo tópico' : kind === 'rename' ? 'Renomear tópico' : 'Prazo para apagar'}</span>
      <div slot="content" className="topic-dialog-content">
        {kind !== 'expiry' && (
          <md-outlined-text-field
            ref={field}
            label="Nome do tópico"
            maxLength={MAX_TOPIC_TITLE}
            value={title}
            oninput={(e: Event) => setTitle((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
          />
        )}
        {kind !== 'rename' && (
          <>
            <label className="settings-switch">
              <span>
                <span className="type-body-medium">Temporário</span>
                <span className="type-body-small">Apaga sozinho no prazo</span>
              </span>
              <md-switch
                selected={temporary}
                aria-label="Temporário"
                onchange={(e: Event) => setTemporary((e.target as HTMLElement & { selected: boolean }).selected)}
              />
            </label>
            {temporary && (
              <md-chip-set aria-label="Apagar depois de">
                {DURATIONS.map((d) => (
                  <Choice key={d} label={DURATION_LABEL[d]} selected={duration === d} onClick={() => setDuration(d)} />
                ))}
              </md-chip-set>
            )}
            <p className="type-body-small topic-dialog-note">
              {temporary
                ? `Apaga em ${stamp(Date.now() + TOPIC_DURATIONS[duration])}, nos dois PCs. Use Salvar em arquivo antes, se precisar guardar.`
                : current
                  ? `Hoje apaga em ${stamp(current)}. Desligado, fica até alguém apagar.`
                  : 'Fica até alguém apagar.'}
            </p>
          </>
        )}
      </div>
      <div slot="actions">
        <md-text-button onClick={onClose}>Cancelar</md-text-button>
        <md-text-button onClick={submit} disabled={!valid}>
          {kind === 'create' ? 'Criar' : 'Salvar'}
        </md-text-button>
      </div>
    </md-dialog>
  )
}

type DeleteProps = {
  topic: Topic | null
  count: number
  onClose: () => void
  onDelete: (saveFirst: boolean) => void
}

export function DeleteTopicDialog({ topic, count, onClose, onDelete }: DeleteProps) {
  const run = (saveFirst: boolean) => {
    onDelete(saveFirst)
    onClose()
  }
  return (
    <md-dialog open={topic !== null} onclosed={onClose} className="topic-dialog">
      <span slot="headline">Apagar #{topic?.title}?</span>
      <div slot="content" className="type-body-medium">
        Apaga o tópico e {count === 1 ? 'a mensagem dele' : `as ${count} mensagens dele`} nos dois PCs. As notas que você salvou continuam.
      </div>
      <div slot="actions">
        <md-text-button onClick={onClose}>Cancelar</md-text-button>
        <md-text-button onClick={() => run(true)}>Salvar e apagar</md-text-button>
        <md-text-button className="danger-button" onClick={() => run(false)}>
          Apagar
        </md-text-button>
      </div>
    </md-dialog>
  )
}
