import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig, LinkStatus } from '../../shared/api'
import type { ChatMessage, PeerInfo } from '../../shared/protocol'
import { Chat } from './Chat'
import { Settings } from './Settings'

const api = window.pairlan

export function App() {
  const [self, setSelf] = useState<PeerInfo | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [status, setStatus] = useState<LinkStatus>({ state: 'idle', peer: null, address: null })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [peerTyping, setPeerTyping] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const typingTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void api.getState().then((s) => {
      setSelf(s.self)
      setConfig(s.config)
      setStatus(s.status)
      setMessages(s.history)
    })
    const offs = [
      api.onStatus(setStatus),
      api.onChat((m) => {
        setPeerTyping(false)
        setMessages((prev) => [...prev, m])
      }),
      api.onTyping(() => {
        setPeerTyping(true)
        window.clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => setPeerTyping(false), 3000)
      }),
      api.onConfig((c) => {
        setConfig(c)
        setSelf({ id: c.id, name: c.name })
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const send = useCallback(async (text: string) => {
    const msg = await api.sendChat(text)
    if (msg) setMessages((prev) => [...prev, msg])
    return msg !== null
  }, [])

  if (!self || !config) return null

  const connected = status.state === 'connected'
  const label = connected ? status.peer.name : status.state === 'connecting' ? 'conectando…' : 'procurando par na rede…'

  return (
    <main className="app">
      <header className="bar">
        <span className={`dot ${status.state}`} />
        <span className="peer">{label}</span>
        <button className="ghost" onClick={() => setShowSettings((v) => !v)} title="Configurações">
          ⚙
        </button>
      </header>
      {showSettings && (
        <Settings config={config} onChange={(p) => void api.setConfig(p)} onConnect={api.connectManual} />
      )}
      <Chat
        selfId={self.id}
        messages={messages}
        connected={connected}
        peerTyping={peerTyping}
        onSend={send}
        onTyping={api.sendTyping}
      />
    </main>
  )
}
