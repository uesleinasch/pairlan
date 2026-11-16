import { useState } from 'react'
import { expiresIn, type Topic } from '../../shared/topics'

type Props = {
  topic: Topic | null
  unreadElsewhere: number
  onOpenList: () => void
  onRename: () => void
  onExpiry: () => void
  onExport: () => void
  onDelete: () => void
}

export function TopicBar({ topic, unreadElsewhere, onOpenList, onRename, onExpiry, onExport, onDelete }: Props) {
  const [menu, setMenu] = useState(false)
  const n = unreadElsewhere
  return (
    <div className="topic-bar">
      <span className="badge-anchor">
        <md-icon-button onClick={onOpenList} aria-label={n ? `Conversas (${n} novas)` : 'Conversas'} title="Conversas e tópicos">
          <md-icon>forum</md-icon>
        </md-icon-button>
        {n > 0 && (
          <span className="badge type-label-small" aria-hidden="true">
            {n > 99 ? '99+' : n}
          </span>
        )}
      </span>
      <button type="button" className="topic-bar-text" onClick={onOpenList}>
        <span className="type-title-small">{topic ? `# ${topic.title}` : 'Geral'}</span>
        {topic?.expiresAt && (
          <span className="topic-timer type-body-small">
            <md-icon aria-hidden="true">timer</md-icon>
            Temporário · apaga em {expiresIn(topic.expiresAt)}
          </span>
        )}
      </button>
      <span className="alert-anchor">
        <md-icon-button
          id="topic-menu-button"
          onClick={() => setMenu((open) => !open)}
          aria-label="Opções da conversa"
          title="Opções da conversa"
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <md-icon>more_vert</md-icon>
        </md-icon-button>
        <md-menu anchor="topic-menu-button" positioning="fixed" open={menu} onclosed={() => setMenu(false)}>
          {topic && (
            <md-menu-item onClick={onRename}>
              <md-icon slot="start">edit</md-icon>
              <div slot="headline">Renomear</div>
            </md-menu-item>
          )}
          {topic && (
            <md-menu-item onClick={onExpiry}>
              <md-icon slot="start">timer</md-icon>
              <div slot="headline">Prazo para apagar</div>
            </md-menu-item>
          )}
          <md-menu-item onClick={onExport}>
            <md-icon slot="start">download</md-icon>
            <div slot="headline">Salvar em arquivo</div>
          </md-menu-item>
          {topic && (
            <md-menu-item className="danger-item" onClick={onDelete}>
              <md-icon slot="start">delete</md-icon>
              <div slot="headline">Apagar tópico</div>
            </md-menu-item>
          )}
        </md-menu>
      </span>
    </div>
  )
}
