import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { TransferProgress } from '../../shared/api'
import type { Note } from '../../shared/notes'
import type { ChatMessage } from '../../shared/protocol'
import { AttachmentView } from './AttachmentView'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { sendFiles } from './files'
import { formatBytes } from './format'
import type { MenuAt } from './MessageMenu'
import { MessageText } from './MessageText'
import { HIT_LABEL } from './notes'
import type { WalkieState } from './useWalkie'
import { walkieStatusText } from './WalkieButton'

type Walkie = {
  state: WalkieState
  peerLive: boolean
  incoming: boolean
  startTalking: () => Promise<void>
  stopTalking: () => Promise<void>
}

type Props = {
  selfId: string
  peerName: string
  messages: ChatMessage[]
  transfers: TransferProgress[]
  connected: boolean
  searching: boolean
  peerTyping: boolean
  walkie: Walkie
  onSend: (text: string) => Promise<boolean>
  onAttached: (msgs: ChatMessage[]) => void
  onTyping: () => void
  onConnectByIp: () => void
  onSearchAgain: () => void
  notes: Map<string, Note>
  onMessageMenu: (msg: ChatMessage, at: MenuAt) => void
}

const api = window.pairlan

const time = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Conversation(p: Props) {
  const [dragging, setDragging] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [p.messages.length])

  const send = async (files: File[]) => {
    if (!p.connected || files.length === 0) return
    p.onAttached(await sendFiles(files))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void send([...e.dataTransfer.files])
  }

  const status = walkieStatusText(p.walkie.state, p.walkie.peerLive) || (p.peerTyping ? `${p.peerName} está digitando…` : '')

  return (
    <section
      className={dragging ? 'conversation dragging' : 'conversation'}
      onDragOver={(e) => {
        e.preventDefault()
        if (p.connected) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {p.walkie.incoming && (
        <div className="incoming-voice type-label-large" role="status">
          <md-icon aria-hidden="true">graphic_eq</md-icon>
          {p.peerName} está falando…
        </div>
      )}

      <div className="messages" ref={listRef} role="log" aria-live="polite" aria-label="Mensagens">
        {p.messages.length === 0 ? (
          <EmptyState
            connected={p.connected}
            searching={p.searching}
            onConnectByIp={p.onConnectByIp}
            onSearchAgain={p.onSearchAgain}
          />
        ) : (
          p.messages.map((m) => {
            const note = p.notes.get(m.id)
            return (
              <article
                key={m.id}
                id={`msg-${m.id}`}
                className={m.from === p.selfId ? 'bubble mine' : 'bubble'}
                onContextMenu={(e) => {
                  e.preventDefault()
                  p.onMessageMenu(m, { x: e.clientX, y: e.clientY })
                }}
              >
                <header className="type-body-small">
                  <strong>{m.fromName}</strong> · <time>{time(m.ts)}</time>
                  {note &&
                    (note.hit ? (
                      <span className={`bubble-hit ${note.hit}`} role="img" aria-label={`Hit ${HIT_LABEL[note.hit].toLowerCase()}`} title={`Hit ${HIT_LABEL[note.hit].toLowerCase()}`} />
                    ) : (
                      <md-icon className="bubble-saved" role="img" aria-label="Salva nas notas" title="Salva nas notas">
                        bookmark
                      </md-icon>
                    ))}
                </header>
                {m.attachment ? <AttachmentView id={m.id} attachment={m.attachment} /> : <MessageText text={m.text} />}
              </article>
            )
          })
        )}
      </div>

      {p.transfers.map((t) => (
        <div key={t.id} className="transfer type-body-small">
          <span>
            {t.direction === 'out' ? 'Enviando' : 'Recebendo'} {t.name} — {formatBytes(t.done)} de {formatBytes(t.total)}
          </span>
          <md-linear-progress value={t.total ? t.done / t.total : 0} aria-label={`Transferência de ${t.name}`} />
        </div>
      ))}

      <p className={`composer-status type-body-small ${p.walkie.state}`} role="status">
        {status}
      </p>

      {dragging && (
        <div className="drop-overlay type-title-medium">
          <md-icon aria-hidden="true">upload_file</md-icon>
          Solte para enviar
        </div>
      )}

      <Composer
        connected={p.connected}
        placeholder={p.connected ? 'Mensagem' : 'Escreva; envia quando o par conectar'}
        walkie={p.walkie}
        onSend={p.onSend}
        onAttach={() => void api.pickFiles().then(p.onAttached)}
        onFiles={(files) => void send(files)}
        onTyping={p.onTyping}
      />
    </section>
  )
}
