import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig, LinkStatus, TransferProgress } from '../../shared/api'
import type { ChatMessage, PeerInfo } from '../../shared/protocol'
import { Conversation } from './Conversation'
import { MediaControls } from './MediaControls'
import { ScreenView } from './ScreenView'
import { SettingsDialog } from './SettingsDialog'
import { Snackbar, useSnackbar } from './Snackbar'
import { SystemAudioBar } from './SystemAudioBar'
import { TerminalView } from './terminal/TerminalView'
import { TopAppBar } from './TopAppBar'
import { useScreenShare } from './useScreenShare'
import { useSystemAudio } from './useSystemAudio'
import { useWalkie } from './useWalkie'

const api = window.pairlan

export function App() {
  const [self, setSelf] = useState<PeerInfo | null>(null)
  const [prompt, setPrompt] = useState('')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [status, setStatus] = useState<LinkStatus>({ state: 'idle', peer: null, address: null })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [peerTyping, setPeerTyping] = useState(false)
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [searching, setSearching] = useState(true)
  const [controlAllowed, setControlAllowed] = useState(false)
  const [controlBusy, setControlBusy] = useState(false)
  const [peerControl, setPeerControl] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const typingTimer = useRef<number | undefined>(undefined)
  const snackbar = useSnackbar()

  const connected = status.state === 'connected'
  const share = useScreenShare(connected)
  const appendMessages = useCallback((msgs: ChatMessage[]) => setMessages((prev) => [...prev, ...msgs]), [])
  const walkie = useWalkie(connected, config?.liveAudio ?? true, appendMessages)
  const { startTalking, stopTalking } = walkie
  const ducked = walkie.state !== 'idle'
  const systemAudio = useSystemAudio(connected, config?.liveAudio ?? true, ducked)

  useEffect(() => {
    void api.getState().then((s) => {
      setSelf(s.self)
      setPrompt(s.prompt)
      setConfig(s.config)
      setStatus(s.status)
      setSearching(s.searching)
      setMessages(s.history)
    })
    const offs = [
      api.onStatus(setStatus),
      api.onSearching(setSearching),
      api.onControlState(setControlAllowed),
      api.onPeerControl(setPeerControl),
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

  const { show } = snackbar
  useEffect(() => {
    if (share.error) show(share.error)
  }, [share.error, show])
  useEffect(() => {
    if (walkie.error) show(walkie.error)
  }, [walkie.error, show])
  const startAudio = useRef(systemAudio.start)
  startAudio.current = systemAudio.start
  useEffect(() => {
    if (systemAudio.error) show(systemAudio.error, { label: 'Tentar de novo', run: () => void startAudio.current() })
  }, [systemAudio.error, show])

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
    const block = (e: globalThis.DragEvent) => e.preventDefault()
    document.addEventListener('dragover', block)
    document.addEventListener('drop', block)
    return () => {
      document.removeEventListener('dragover', block)
      document.removeEventListener('drop', block)
    }
  }, [])

  useEffect(() => {
    if (!config) return
    const root = document.documentElement.style
    root.setProperty('--bg-alpha', String(config.opacity))
    root.setProperty('--content-alpha', String(0.75 + config.opacity * 0.25))
  }, [config])

  const toggleControl = async () => {
    setControlBusy(true)
    const result = await api.setControl(!controlAllowed)
    setControlBusy(false)
    if (!result.ok && result.error) show(result.error)
  }

  const send = useCallback(async (text: string) => {
    const msg = await api.sendChat(text)
    if (msg) setMessages((prev) => [...prev, msg])
    return msg !== null
  }, [])

  if (!self || !config) return null

  const peerName = connected ? status.peer.name : ''
  const showScreen = connected && (share.remoteSharing || share.remoteStream !== null)
  const outgoing = [share.sharing && 'tela', systemAudio.sharing && 'áudio do PC'].filter((v): v is string => Boolean(v))

  if (config.terminalMode) {
    return (
      <TerminalView
        prompt={prompt}
        self={self}
        config={config}
        status={status}
        searching={searching}
        messages={messages}
        transfers={transfers}
        peerTyping={peerTyping}
        walkie={walkie}
        share={share}
        systemAudio={systemAudio}
        ducked={ducked}
        controlAllowed={controlAllowed}
        controlBusy={controlBusy}
        peerControl={peerControl}
        notice={snackbar.item}
        onDismissNotice={snackbar.dismiss}
        onToggleControl={() => void toggleControl()}
        onSend={send}
        onAttached={appendMessages}
      />
    )
  }

  return (
    <main className="app">
      <TopAppBar
        status={status}
        searching={searching}
        outgoing={outgoing}
        onToggleSearch={() => api.setSearching(!searching)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {!connected && (searching || status.state === 'connecting') && <md-linear-progress indeterminate className="searching" aria-label="Procurando o par" />}
      <MediaControls
        connected={connected}
        sharingScreen={share.sharing}
        sharingAudio={systemAudio.sharing}
        audioBusy={systemAudio.starting}
        controlAllowed={controlAllowed}
        controlBusy={controlBusy}
        onToggleControl={() => void toggleControl()}
        liveAudio={config.liveAudio}
        onToggleScreen={() => (share.sharing ? share.stopSharing() : void share.startSharing())}
        onToggleAudio={() => (systemAudio.sharing ? systemAudio.stop() : void systemAudio.start())}
        onToggleLiveAudio={() => void api.setConfig({ liveAudio: !config.liveAudio })}
      />
      <div className={showScreen ? 'body split' : 'body'}>
        {showScreen && <ScreenView stream={share.remoteStream} peerName={peerName} canControl={peerControl} />}
        <div className="side">
          {connected && systemAudio.incoming && (
            <SystemAudioBar
              peerName={peerName}
              muted={systemAudio.muted}
              volume={systemAudio.volume}
              ducked={ducked}
              onToggleMute={() => systemAudio.setMuted(!systemAudio.muted)}
              onVolume={systemAudio.setVolume}
            />
          )}
          <Conversation
            selfId={self.id}
            peerName={peerName}
            messages={messages}
            transfers={transfers}
            connected={connected}
            searching={searching}
            peerTyping={peerTyping}
            walkie={walkie}
            onSend={send}
            onAttached={appendMessages}
            onTyping={api.sendTyping}
            onConnectByIp={() => setSettingsOpen(true)}
            onSearchAgain={() => api.setSearching(true)}
          />
        </div>
      </div>
      <SettingsDialog
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch) => void api.setConfig(patch)}
        onConnect={api.connectManual}
      />
      <Snackbar item={snackbar.item} onDismiss={snackbar.dismiss} />
    </main>
  )
}
