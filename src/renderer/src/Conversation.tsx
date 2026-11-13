import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import type { TransferProgress } from '../../shared/api'
import type { ChatMessage } from '../../shared/protocol'
import { AttachmentView } from './AttachmentView'
import { EmptyState } from './EmptyState'
import { formatBytes, pastedFileName } from './format'
import { MessageText } from './MessageText'
import type { WalkieState } from './useWalkie'
import { WalkieButton, walkieStatusText } from './WalkieButton'

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
}

const api = window.pairlan

const time = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Conversation(p: Props) {
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLElement>(null)
  const lastTyping = useRef(0)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [p.messages.length])

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const submit = async () => {
    if (!draft.trim() || !p.connected) return
    if (await p.onSend(draft)) setDraft('')
  }

  const sendFiles = async (files: File[]) => {
    if (!p.connected || files.length === 0) return
    const paths: string[] = []
    for (const file of files) {
      const path = api.pathForFile(file)
      if (path) paths.push(path)
      else p.onAttached(await api.sendFileData(file.name || pastedFileName(file.type), await file.arrayBuffer()))
    }
    if (paths.length) p.onAttached(await api.sendFilePaths(paths))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      void submit()
      return
    }
    const now = Date.now()
    if (now - lastTyping.current > 2000) {
      lastTyping.current = now
      p.onTyping()
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files]
    if (files.length === 0) return
    e.preventDefault()
    void sendFiles(files.map((f) => (f.name ? f : new File([f], pastedFileName(f.type), { type: f.type }))))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void sendFiles([...e.dataTransfer.files])
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
          p.messages.map((m) => (
            <article key={m.id} className={m.from === p.selfId ? 'bubble mine' : 'bubble'}>
              <header className="type-body-small">
                <strong>{m.fromName}</strong> · <time>{time(m.ts)}</time>
              </header>
              {m.attachment ? <AttachmentView id={m.id} attachment={m.attachment} /> : <MessageText text={m.text} />}
            </article>
          ))
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

      <div className="composer">
        <md-icon-button
          onClick={() => void api.pickFiles().then(p.onAttached)}
          disabled={!p.connected}
          aria-label="Anexar arquivo"
          title="Anexar arquivo (ou arraste / cole)"
        >
          <md-icon>attach_file</md-icon>
        </md-icon-button>
        <md-outlined-text-field
          ref={fieldRef}
          className="composer-field"
          type="textarea"
          rows={2}
          value={draft}
          aria-label="Mensagem"
          placeholder={p.connected ? 'Mensagem — ``` para código' : 'Escreva; envia quando o par conectar'}
          oninput={(e: Event) => setDraft((e.target as HTMLTextAreaElement).value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <md-filled-icon-button
          onClick={() => void submit()}
          disabled={!p.connected || !draft.trim()}
          aria-label="Enviar"
          title="Enviar (Enter)"
        >
          <md-icon>send</md-icon>
        </md-filled-icon-button>
        <WalkieButton
          state={p.walkie.state}
          peerLive={p.walkie.peerLive}
          disabled={!p.connected}
          onStart={() => void p.walkie.startTalking()}
          onStop={() => void p.walkie.stopTalking()}
        />
      </div>
    </section>
  )
}
