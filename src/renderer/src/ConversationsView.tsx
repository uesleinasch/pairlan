import type { ChatMessage } from '../../shared/protocol'
import { expiresIn, type Topic } from '../../shared/topics'
import { preview } from './notes'
import { GENERAL, sortByActivity } from './topics'

type Props = {
  topics: Topic[]
  last: Map<string, ChatMessage>
  unread: Map<string, number>
  active: string
  selfId: string
  peerName: string
  onBack: () => void
  onPick: (key: string) => void
  onNew: () => void
}

function when(ts: number, now = new Date()): string {
  const d = new Date(ts)
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ConversationsView({ topics, last, unread, active, selfId, peerName, onBack, onPick, onNew }: Props) {
  const row = (key: string, title: string, topic: Topic | null) => {
    const m = last.get(key)
    const n = unread.get(key) ?? 0
    const body = m ? `${m.from === selfId ? 'você' : m.fromName}: ${m.attachment ? `[anexo] ${m.attachment.name}` : preview(m.text, 48)}` : 'sem mensagens'
    return (
      <button key={key || 'geral'} type="button" className={key === active ? 'conv-row on' : 'conv-row'} aria-current={key === active} onClick={() => onPick(key)}>
        <span className="conv-avatar" aria-hidden="true">
          {topic ? '#' : <md-icon>chat</md-icon>}
        </span>
        <span className="conv-main">
          <span className={n ? 'conv-title type-body-large strong' : 'conv-title type-body-large'}>{title}</span>
          <span className="conv-preview type-body-medium">{body}</span>
          {topic?.expiresAt && (
            <span className="conv-timer type-body-small">
              <md-icon aria-hidden="true">timer</md-icon>
              apaga em {expiresIn(topic.expiresAt)}
            </span>
          )}
        </span>
        <span className="conv-side">
          {m && <span className={n ? 'type-body-small fresh' : 'type-body-small'}>{when(m.ts)}</span>}
          {n > 0 && (
            <span className="conv-count type-label-small" aria-label={`${n} novas`}>
              {n > 99 ? '99+' : n}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <section
      className="conversations-view"
      aria-label="Conversas"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onBack()
      }}
    >
      <header className="top-app-bar">
        <md-icon-button onClick={onBack} aria-label="Voltar ao chat" title="Voltar ao chat (Esc)">
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <div className="top-app-bar-text">
          <h1 className="type-title-large">Conversas</h1>
          <p className="type-body-small">{peerName ? `com ${peerName} · ` : ''}os dois veem os mesmos tópicos</p>
        </div>
      </header>
      <div className="conv-list">
        {row(GENERAL, 'Geral', null)}
        <h2 className="notes-section type-title-small">Tópicos</h2>
        {topics.length === 0 ? (
          <p className="conv-empty type-body-medium">Crie um tópico para separar um assunto, como uma conversa à parte.</p>
        ) : (
          sortByActivity(topics, last).map((t) => row(t.id, t.title, t))
        )}
      </div>
      <button type="button" className="fab type-label-large" onClick={onNew}>
        <md-icon aria-hidden="true">add</md-icon>
        Novo tópico
      </button>
    </section>
  )
}
