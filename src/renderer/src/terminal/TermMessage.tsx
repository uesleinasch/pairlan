import { useEffect, useRef, useState } from 'react'
import type { Attachment, ChatMessage } from '../../../shared/protocol'
import { formatBytes } from '../format'
import { splitFences } from '../text'

const api = window.pairlan

export const clock = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function VoiceLine({ id }: { id: string }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => audio.current?.pause(), [])

  const toggle = async () => {
    if (playing) {
      audio.current?.pause()
      return
    }
    if (!audio.current) {
      const url = await api.previewFile(id)
      if (!url) return
      const el = new Audio(url)
      el.onplay = () => setPlaying(true)
      el.onpause = el.onended = () => setPlaying(false)
      audio.current = el
    }
    void audio.current.play()
  }

  return (
    <>
      [voz]{' '}
      <button type="button" className="term-link" onClick={() => void toggle()}>
        {playing ? 'parar' : 'ouvir'}
      </button>
    </>
  )
}

function AttachmentLine({ id, attachment }: { id: string; attachment: Attachment }) {
  if (attachment.mime.startsWith('audio/')) return <VoiceLine id={id} />
  return (
    <>
      [anexo] {attachment.name} <span className="term-dim">{formatBytes(attachment.size)}</span>{' '}
      <button type="button" className="term-link" onClick={() => api.openFile(id)}>
        abrir
      </button>{' '}
      <button type="button" className="term-link" onClick={() => api.revealFile(id)}>
        pasta
      </button>
    </>
  )
}

export function TermMessage({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  return (
    <div className="term-msg">
      <span className="term-prefix">
        <span className="term-dim">[{clock(msg.ts)}]</span> <span className={mine ? 'term-me' : 'term-peer'}>{msg.fromName}</span>
      </span>
      <div className="term-content">
        {msg.attachment ? (
          <AttachmentLine id={msg.id} attachment={msg.attachment} />
        ) : (
          splitFences(msg.text).map((part, i) =>
            part.kind === 'code' ? (
              <pre key={i} className="term-code">
                {part.value}
              </pre>
            ) : (
              <p key={i} className="term-text">
                {part.value.replace(/^\n+|\n+$/g, '')}
              </p>
            )
          )
        )}
      </div>
    </div>
  )
}
