import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../../shared/protocol'
import { MessageText } from './MessageText'

type Props = {
  selfId: string
  messages: ChatMessage[]
  connected: boolean
  peerTyping: boolean
  onSend: (text: string) => Promise<boolean>
  onTyping: () => void
}

const time = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Chat({ selfId, messages, connected, peerTyping, onSend, onTyping }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastTyping = useRef(0)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const submit = async () => {
    if (!draft.trim() || !connected) return
    if (await onSend(draft)) setDraft('')
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

  return (
    <section className="chat">
      <div className="messages" ref={listRef}>
        {messages.length === 0 && <p className="empty">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <article key={m.id} className={m.from === selfId ? 'msg mine' : 'msg'}>
            <header>
              <strong>{m.fromName}</strong> <time>{time(m.ts)}</time>
            </header>
            <MessageText text={m.text} />
          </article>
        ))}
      </div>
      <div className="typing">{peerTyping ? 'digitando…' : ''}</div>
      <div className="composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={connected ? 'Mensagem (Shift+Enter quebra linha, ``` para código)' : 'Aguardando o par…'}
          disabled={!connected}
          rows={3}
        />
        <button onClick={() => void submit()} disabled={!connected || !draft.trim()}>
          Enviar
        </button>
      </div>
    </section>
  )
}
