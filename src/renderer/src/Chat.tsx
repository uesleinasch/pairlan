import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import type { TransferProgress } from '../../shared/api'
import type { ChatMessage } from '../../shared/protocol'
import { AttachmentView } from './AttachmentView'
import { formatBytes, pastedFileName } from './format'
import { MessageText } from './MessageText'
import type { WalkieState } from './useWalkie'
import { WalkieButton, walkieStatusText } from './WalkieButton'

type Props = {
  selfId: string
  messages: ChatMessage[]
  transfers: TransferProgress[]
  connected: boolean
  peerTyping: boolean
  onSend: (text: string) => Promise<boolean>
  onAttached: (msgs: ChatMessage[]) => void
  onTyping: () => void
  walkie: {
    state: WalkieState
    peerLive: boolean
    incoming: boolean
    error: string
    startTalking: () => Promise<void>
    stopTalking: () => Promise<void>
  }
  peerName: string
}

const api = window.pairlan

const time = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Chat({
  selfId,
  messages,
  transfers,
  connected,
  peerTyping,
  onSend,
  onAttached,
  onTyping,
  walkie,
  peerName
}: Props) {
  const walkieText = walkie.error || walkieStatusText(walkie.state, walkie.peerLive)
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastTyping = useRef(0)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const submit = async () => {
    if (!draft.trim() || !connected) return
    if (await onSend(draft)) setDraft('')
  }

  const sendFiles = async (files: File[]) => {
    if (!connected || files.length === 0) return
    const paths: string[] = []
    for (const file of files) {
      const path = api.pathForFile(file)
      if (path) paths.push(path)
      else onAttached(await api.sendFileData(file.name || pastedFileName(file.type), await file.arrayBuffer()))
    }
    if (paths.length) onAttached(await api.sendFilePaths(paths))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
      return
    }
    const now = Date.now()
    if (now - lastTyping.current > 2000) {
      lastTyping.current = now
      onTyping()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
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

  return (
    <section
      className={dragging ? 'chat dragging' : 'chat'}
      onDragOver={(e) => {
        e.preventDefault()
        if (connected) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className="messages" ref={listRef}>
        {messages.length === 0 && <p className="empty">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <article key={m.id} className={m.from === selfId ? 'msg mine' : 'msg'}>
            <header>
              <strong>{m.fromName}</strong> <time>{time(m.ts)}</time>
            </header>
            {m.attachment ? <AttachmentView id={m.id} attachment={m.attachment} /> : <MessageText text={m.text} />}
          </article>
        ))}
      </div>
      {transfers.map((t) => (
        <div key={t.id} className="transfer">
          <span>
            {t.direction === 'out' ? 'Enviando' : 'Recebendo'} {t.name} — {formatBytes(t.done)} / {formatBytes(t.total)}
          </span>
          <progress value={t.done} max={t.total || 1} />
        </div>
      ))}
      {walkie.incoming && <div className="walkie-incoming">🔊 {peerName} falando…</div>}
      <div className="typing">{walkieText || (peerTyping ? 'digitando…' : '')}</div>
      {dragging && <div className="drop-hint">Solte para enviar</div>}
      <div className="composer">
        <button className="ghost attach" onClick={() => void api.pickFiles().then(onAttached)} disabled={!connected} title="Anexar arquivo">
          📎
        </button>
        <WalkieButton
          state={walkie.state}
          peerLive={walkie.peerLive}
          disabled={!connected}
          onStart={() => void walkie.startTalking()}
          onStop={() => void walkie.stopTalking()}
        />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={
            connected
              ? 'Mensagem (Shift+Enter quebra linha, ``` para código, cole ou arraste arquivos)'
              : 'Sem par conectado — dá para escrever, envia quando conectar'
          }
          autoFocus
          rows={3}
        />
        <button onClick={() => void submit()} disabled={!connected || !draft.trim()}>
          Enviar
        </button>
      </div>
    </section>
  )
}
