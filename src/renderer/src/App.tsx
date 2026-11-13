import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig, LinkStatus, TransferProgress } from '../../shared/api'
import type { ChatMessage, PeerInfo } from '../../shared/protocol'
import { Chat } from './Chat'
import { ScreenView } from './ScreenView'
import { Settings } from './Settings'
import { TitleBar } from './TitleBar'
import { useScreenShare } from './useScreenShare'
import { useWalkie } from './useWalkie'

const api = window.pairlan

export function App() {
  const [self, setSelf] = useState<PeerInfo | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [status, setStatus] = useState<LinkStatus>({ state: 'idle', peer: null, address: null })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [peerTyping, setPeerTyping] = useState(false)
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const typingTimer = useRef<number | undefined>(undefined)
  const share = useScreenShare(status.state === 'connected')
  const appendMessages = useCallback((msgs: ChatMessage[]) => setMessages((prev) => [...prev, ...msgs]), [])
  const walkie = useWalkie(status.state === 'connected', config?.liveAudio ?? true, appendMessages)
  const { startTalking, stopTalking } = walkie

  useEffect(() => {
    const isHotkey = (e: KeyboardEvent) => e.ctrlKey && e.code === 'Space'
    const down = (e: KeyboardEvent) => {
      if (!isHotkey(e)) return
      e.preventDefault()
      if (!e.repeat) void startTalking()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Control') void stopTalking()
    }
    const blur = () => void stopTalking()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [startTalking, stopTalking])

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
      api.onTransfer((p) =>
        setTransfers((prev) => (p.finished ? prev.filter((t) => t.id !== p.id) : [...prev.filter((t) => t.id !== p.id), p]))
      ),
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

  useEffect(() => {
    if (!config) return
    const root = document.documentElement.style
    root.setProperty('--bg-alpha', String(config.opacity))
    root.setProperty('--content-alpha', String(0.5 + config.opacity / 2))
  }, [config])

  useEffect(() => {
    const block = (e: globalThis.DragEvent) => e.preventDefault()
    document.addEventListener('dragover', block)
    document.addEventListener('drop', block)
    return () => {
      document.removeEventListener('dragover', block)
      document.removeEventListener('drop', block)
    }
  }, [])

  if (!self || !config) return null

  const connected = status.state === 'connected'

  return (
    <main className="app">
      <TitleBar
        status={status}
        liveAudio={config.liveAudio}
        onToggleLiveAudio={() => void api.setConfig({ liveAudio: !config.liveAudio })}
        sharing={share.sharing}
        onShare={() => void share.startSharing()}
        onStopShare={() => share.stopSharing()}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />
      {share.error && <p className="notice">{share.error}</p>}
      {share.sharing && <p className="notice live">Você está compartilhando a tela</p>}
      {connected && (share.remoteSharing || share.remoteStream) && (
        <ScreenView stream={share.remoteStream} peerName={status.peer.name} />
      )}
      {showSettings && (
        <Settings config={config} onChange={(p) => void api.setConfig(p)} onConnect={api.connectManual} />
      )}
      <Chat
        selfId={self.id}
        messages={messages}
        transfers={transfers}
        onAttached={appendMessages}
        walkie={walkie}
        peerName={connected ? status.peer.name : ''}
        connected={connected}
        peerTyping={peerTyping}
        onSend={send}
        onTyping={api.sendTyping}
      />
    </main>
  )
}
