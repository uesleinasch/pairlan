import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig, InternetStatus, LinkStatus, TransferProgress, WifiDirectStatus } from '../../shared/api'
import type { Note } from '../../shared/notes'
import type { Topic, TopicDuration } from '../../shared/topics'
import type { ChatMessage, PeerInfo } from '../../shared/protocol'
import { Conversation } from './Conversation'
import { MediaControls } from './MediaControls'
import { MessageMenu, type MenuAt } from './MessageMenu'
import { HIT_LABEL, noteBody } from './notes'
import { NotesView } from './NotesView'
import { ConversationsView } from './ConversationsView'
import { TopicBar } from './TopicBar'
import { DeleteTopicDialog, TopicDialog, type TopicDialogMode } from './TopicDialogs'
import { GENERAL, messagesIn } from './topics'
import { useTopics } from './useTopics'
import { setIceServers } from './rtc'
import { incomingText } from './alerts'
import { ScreenView } from './ScreenView'
import { SettingsDialog } from './SettingsDialog'
import { Snackbar, useSnackbar } from './Snackbar'
import { playNotifySound } from './sound'
import { SystemAudioBar } from './SystemAudioBar'
import { TerminalView } from './terminal/TerminalView'
import { TopAppBar } from './TopAppBar'
import { useAlerts } from './useAlerts'
import { copyText, flashElement, useNotes } from './useNotes'
import { useScreenShare } from './useScreenShare'
import { useSystemAudio } from './useSystemAudio'
import { useWalkie } from './useWalkie'

const api = window.pairlan

const NO_INTERNET: InternetStatus = {
  state: 'off',
  error: null,
  relayUrl: '',
  me: '',
  myFingerprint: '',
  peer: null,
  peerFingerprint: null
}

export function App() {
  const [self, setSelf] = useState<PeerInfo | null>(null)
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
  const [wifi, setWifi] = useState<WifiDirectStatus>({ state: 'unsupported', self: null, peer: null, ip: null, error: null })
  const [internet, setInternet] = useState<InternetStatus>(NO_INTERNET)
  const typingTimer = useRef<number | undefined>(undefined)
  const snackbar = useSnackbar()

  const connected = status.state === 'connected'
  const share = useScreenShare(connected)
  const appendMessages = useCallback((msgs: ChatMessage[]) => setMessages((prev) => [...prev, ...msgs]), [])
  const walkie = useWalkie(connected, config?.liveAudio ?? true, appendMessages)
  const { startTalking, stopTalking } = walkie
  const ducked = walkie.state !== 'idle'
  const systemAudio = useSystemAudio(connected, config?.liveAudio ?? true, ducked)
  const alerts = useAlerts(connected)
  const notes = useNotes()
  const dropTopicMessages = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.topic !== id)), [])
  const topics = useTopics(messages, self?.id ?? '', dropTopicMessages)
  const { setTopics } = topics
  const [convOpen, setConvOpen] = useState(false)
  const [topicDialog, setTopicDialog] = useState<TopicDialogMode | null>(null)
  const [deleting, setDeleting] = useState<Topic | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [menu, setMenu] = useState<{ msg: ChatMessage; at: MenuAt } | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(null)

  useEffect(() => {
    void api.getState().then((s) => {
      setSelf(s.self)
      setConfig(s.config)
      setStatus(s.status)
      setSearching(s.searching)
      setMessages(s.history)
      setTopics(s.topics)
      setWifi(s.wifiDirect)
      setInternet(s.internet)
      setIceServers(s.iceServers)
    })
    const offs = [
      api.onStatus(setStatus),
      api.onWifiDirect(setWifi),
      api.onInternet(setInternet),
      api.onIceServers(setIceServers),
      api.onPlaySound(() => void playNotifySound()),
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
  }, [setTopics])

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

  const controlRequest = useRef({ sharing: false, peer: '', allow: () => {} })
  controlRequest.current = {
    sharing: share.sharing,
    peer: status.state === 'connected' ? status.peer.name : 'O par',
    allow: () => void toggleControl()
  }
  useEffect(
    () =>
      api.onControlRequested(() => {
        const { sharing, peer, allow } = controlRequest.current
        if (sharing) show(`${peer} pediu para controlar seu mouse e teclado.`, { label: 'Permitir', run: allow }, 'info')
        else show(`${peer} pediu para controlar seu mouse e teclado. Compartilhe a tela antes.`, undefined, 'info')
      }),
    [show]
  )

  useEffect(() => {
    if (notesOpen || !jumpTo) return
    if (!flashElement(`msg-${jumpTo}`)) show('Essa mensagem não está mais no histórico.', undefined, 'info')
    setJumpTo(null)
  }, [notesOpen, jumpTo, show])

  const clearHistory = useCallback(async () => {
    await api.clearHistory()
    setMessages([])
  }, [])

  const send = useCallback(async (text: string) => {
    const msg = await api.sendChat(text)
    if (msg) setMessages((prev) => [...prev, msg])
    return msg !== null
  }, [])

  if (!self || !config) return null

  const peerName = connected ? status.peer.name : ''
  const requestControl = () => {
    api.requestControl()
    show(`Pedido enviado: ${peerName} precisa liberar o controle.`, undefined, 'info')
  }
  const showScreen = connected && (share.remoteSharing || share.remoteStream !== null)
  const outgoing = [share.sharing && 'tela', systemAudio.sharing && 'áudio do PC'].filter((v): v is string => Boolean(v))

  if (config.terminalMode) {
    return (
      <TerminalView
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
        onRequestControl={requestControl}
        onSend={send}
        onAttached={appendMessages}
        onClearHistory={clearHistory}
        wifi={wifi}
        internet={internet}
        alerts={alerts}
        notes={notes}
        topics={topics}
      />
    )
  }

  const copy = (text: string) => void copyText(text).then((ok) => show(ok ? 'Copiado.' : 'Não deu para copiar.', undefined, ok ? 'info' : 'error'))
  const openNotes = { label: 'Ver notas', run: () => setNotesOpen(true) }
  const exportTopic = async (id: string | null) => {
    const result = await api.exportTopic(id)
    if (result.ok) show('Salvo em arquivo.', { label: 'Mostrar', run: () => api.revealExport(result.path) }, 'info')
    else if (result.error) show(result.error)
    return result.ok
  }
  const submitTopic = (title: string, duration: TopicDuration | null) => {
    const mode = topicDialog
    if (!mode) return
    if (mode.kind === 'create') void topics.create(title, duration).then((t) => (t ? setConvOpen(false) : show('Não deu para criar o tópico.')))
    else if (mode.kind === 'rename') void api.renameTopic(mode.topic.id, title)
    else void api.setTopicExpiry(mode.topic.id, duration)
  }
  const deleteTopic = async (topic: Topic, saveFirst: boolean) => {
    if (saveFirst && !(await exportTopic(topic.id))) return
    await api.deleteTopic(topic.id)
    show(`#${topic.title} apagado.`, undefined, 'info')
  }
  const showMessage = (messageId: string) => {
    topics.setActive(notes.notes.find((n) => n.messageId === messageId)?.topic ?? GENERAL)
    setJumpTo(messageId)
    setNotesOpen(false)
  }

  const removeNote = (note: Note) =>
    void notes.remove(note.id).then(() => show('Nota apagada.', { label: 'Desfazer', run: () => void notes.restore(note) }, 'info'))

  const alertClass = [
    alerts.incoming && alerts.incoming !== 'shake' ? `alert-${alerts.incoming}` : '',
    alerts.shaking ? 'shaking' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={alertClass ? `app ${alertClass}` : 'app'}>
      {notesOpen && (
        <NotesView
          notes={notes.notes}
          onBack={() => setNotesOpen(false)}
          onShow={showMessage}
          onHit={(id, hit) => void notes.setHit(id, hit)}
          onComment={(id, comment) => void notes.setComment(id, comment)}
          onRemove={removeNote}
          onCopy={(note) => copy(noteBody(note))}
        />
      )}
      {convOpen && (
        <ConversationsView
          topics={topics.topics}
          last={topics.last}
          unread={topics.unread}
          active={topics.active}
          selfId={self.id}
          peerName={peerName}
          onBack={() => setConvOpen(false)}
          onPick={(key) => {
            topics.setActive(key)
            setConvOpen(false)
          }}
          onNew={() => setTopicDialog({ kind: 'create' })}
        />
      )}
      <div className="chat-pane" hidden={notesOpen || convOpen}>
        <TopAppBar
          status={status}
          searching={searching}
          outgoing={outgoing}
          onToggleSearch={() => api.setSearching(!searching)}
          onOpenSettings={() => setSettingsOpen(true)}
          alert={alerts.outgoing}
          onAlert={alerts.send}
          notesCount={notes.notes.length}
          onOpenNotes={() => {
          setConvOpen(false)
          setNotesOpen(true)
        }}
        />
        {connected && alerts.incoming && (
          <div className={`alert-banner ${alerts.incoming}`} role="alert">
            <md-icon aria-hidden="true">{alerts.incoming === 'shake' ? 'vibration' : 'campaign'}</md-icon>
            <span className="type-body-medium">{incomingText(alerts.incoming, peerName)}</span>
            <md-text-button onClick={alerts.ack}>Vi</md-text-button>
          </div>
        )}
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
        <TopicBar
          topic={topics.topic}
          unreadElsewhere={topics.unreadElsewhere}
          onOpenList={() => setConvOpen(true)}
          onRename={() => topics.topic && setTopicDialog({ kind: 'rename', topic: topics.topic })}
          onExpiry={() => topics.topic && setTopicDialog({ kind: 'expiry', topic: topics.topic })}
          onExport={() => void exportTopic(topics.topic?.id ?? null)}
          onDelete={() => setDeleting(topics.topic)}
        />
        <div className={showScreen ? 'body split' : 'body'}>
          {showScreen && <ScreenView stream={share.remoteStream} peerName={peerName} canControl={peerControl} onRequestControl={requestControl} />}
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
              messages={topics.visible}
              topicTitle={topics.topic?.title}
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
              notes={notes.byMessage}
              onMessageMenu={(msg, at) => setMenu({ msg, at })}
            />
          </div>
        </div>
      </div>
      {menu && (
        <MessageMenu
          variant="m3"
          at={menu.at}
          note={notes.byMessage.get(menu.msg.id)}
          onSave={() => void notes.save(menu.msg).then(() => show('Salvo nas notas.', openNotes, 'info'))}
          onUnsave={() => {
            const note = notes.byMessage.get(menu.msg.id)
            if (note) removeNote(note)
          }}
          onHit={(hit) => {
            const was = notes.byMessage.get(menu.msg.id)?.hit
            void notes.toggleHit(menu.msg, hit).then(() => show(was === hit ? 'Hit removido.' : `Salvo como hit ${HIT_LABEL[hit].toLowerCase()}.`, openNotes, 'info'))
          }}
          onCopy={() => copy(menu.msg.attachment ? menu.msg.attachment.name : menu.msg.text)}
          onClose={() => setMenu(null)}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch) => void api.setConfig(patch)}
        onConnect={api.connectManual}
        onClearHistory={clearHistory}
        wifi={wifi}
        internet={internet}
        connected={connected}
      />
      <TopicDialog mode={topicDialog} onClose={() => setTopicDialog(null)} onSubmit={submitTopic} />
      <DeleteTopicDialog
        topic={deleting}
        count={deleting ? messagesIn(messages, deleting.id, topics.known).length : 0}
        onClose={() => setDeleting(null)}
        onDelete={(saveFirst) => deleting && void deleteTopic(deleting, saveFirst)}
      />
      <Snackbar item={snackbar.item} onDismiss={snackbar.dismiss} />
    </main>
  )
}
