import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { AppConfig, LinkStatus, TransferProgress } from '../../../shared/api'
import type { ChatMessage, PeerInfo } from '../../../shared/protocol'
import { pastedFiles, sendFiles } from '../files'
import { formatBytes } from '../format'
import { ScreenView } from '../ScreenView'
import type { SnackbarAction, SnackbarItem } from '../Snackbar'
import type { useScreenShare } from '../useScreenShare'
import type { useSystemAudio } from '../useSystemAudio'
import type { useWalkie } from '../useWalkie'
import { walkieStatusText } from '../WalkieButton'
import { completeCommand, helpText, parseInput, type CommandName } from './commands'
import { PowerLine } from './PowerLine'
import { TermConfig } from './TermConfig'
import { clock, TermMessage } from './TermMessage'
import './terminal.css'

const api = window.pairlan

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

type LocalLine = { id: number; ts: number; kind: 'cmd' | 'out' | 'err'; text: string; action?: SnackbarAction }

type Props = {
  self: PeerInfo
  config: AppConfig
  status: LinkStatus
  searching: boolean
  messages: ChatMessage[]
  transfers: TransferProgress[]
  peerTyping: boolean
  walkie: ReturnType<typeof useWalkie>
  share: ReturnType<typeof useScreenShare>
  systemAudio: ReturnType<typeof useSystemAudio>
  ducked: boolean
  controlAllowed: boolean
  controlBusy: boolean
  peerControl: boolean
  notice: SnackbarItem | null
  onDismissNotice: () => void
  onToggleControl: () => void
  onSend: (text: string) => Promise<boolean>
  onAttached: (msgs: ChatMessage[]) => void
}

const progressBar = (done: number, total: number) => {
  const ratio = total ? done / total : 0
  const filled = Math.round(ratio * 12)
  return `[${'#'.repeat(filled)}${'.'.repeat(12 - filled)}] ${Math.round(ratio * 100)}%`
}

function useTicker(active: boolean, ms: number): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setTick((t) => t + 1), ms)
    return () => window.clearInterval(timer)
  }, [active, ms])
  return tick
}

export function TerminalView(p: Props) {
  const [draft, setDraft] = useState('')
  const [local, setLocal] = useState<LocalLine[]>([])
  const [clearedAt, setClearedAt] = useState(0)
  const [configOpen, setConfigOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [completions, setCompletions] = useState<string[]>([])
  const seq = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastTyping = useRef(0)

  const connected = p.status.state === 'connected'
  const peerName = p.status.state === 'connected' ? p.status.peer.name : ''
  const busy = !connected && (p.searching || p.status.state === 'connecting')
  const spinner = SPINNER[useTicker(busy, 100) % SPINNER.length]
  useTicker(true, 30_000)
  const showScreen = connected && (p.share.remoteSharing || p.share.remoteStream !== null)

  const push = (kind: LocalLine['kind'], text: string, action?: SnackbarAction) =>
    setLocal((prev) => [...prev, { id: ++seq.current, ts: Date.now(), kind, text, action }])

  const { notice, onDismissNotice } = p
  useEffect(() => {
    if (!notice) return
    setLocal((prev) => [...prev, { id: ++seq.current, ts: Date.now(), kind: 'err', text: `pairlan: ${notice.text}`, action: notice.action }])
    onDismissNotice()
  }, [notice, onDismissNotice])

  const feed = [
    ...p.messages.map((m) => ({ key: `m${m.id}`, ts: m.ts, msg: m })),
    ...local.map((l) => ({ key: `l${l.id}`, ts: l.ts, line: l }))
  ]
    .filter((item) => item.ts >= clearedAt)
    .sort((a, b) => a.ts - b.ts)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [feed.length, p.transfers.length, p.peerTyping, p.walkie.state])

  useEffect(() => {
    if (!configOpen) inputRef.current?.focus()
  }, [configOpen])

  const needPeer = () => {
    if (connected) return true
    push('err', 'pairlan: sem par conectado')
    return false
  }

  const run = async (name: CommandName, arg: string) => {
    switch (name) {
      case 'help':
        return push('out', helpText())
      case 'tela':
        if (!needPeer()) return
        if (p.share.sharing) p.share.stopSharing()
        else await p.share.startSharing()
        return
      case 'audio':
        if (!needPeer()) return
        if (p.systemAudio.sharing) p.systemAudio.stop()
        else await p.systemAudio.start()
        return
      case 'ouvir': {
        const next = await api.setConfig({ liveAudio: !p.config.liveAudio })
        return push('out', `ouvir ao vivo: ${next.liveAudio ? 'on' : 'off'}`)
      }
      case 'controle':
        if (!p.share.sharing) return push('err', 'pairlan: compartilhe a tela antes (/tela)')
        return p.onToggleControl()
      case 'anexo':
        if (!needPeer()) return
        return p.onAttached(await api.pickFiles())
      case 'parar':
        api.setSearching(false)
        return push('out', 'busca pausada. você não aparece na rede.')
      case 'buscar':
        api.setSearching(true)
        return push('out', 'procurando o par de novo…')
      case 'conectar':
        if (!arg) return push('err', 'uso: /conectar 192.168.0.12')
        if (await api.connectManual(arg)) return push('out', `conectando a ${arg}…`)
        return push('err', 'pairlan: ip inválido ou fora da rede local (10.x, 172.16-31.x, 192.168.x)')
      case 'config':
        return setConfigOpen(true)
      case 'tema':
        void api.setConfig({ terminalMode: false })
        return
      case 'limpar':
        setLocal([])
        return setClearedAt(Date.now())
    }
  }

  const submit = async () => {
    const input = draft
    if (!input.trim()) return
    setCompletions([])
    const parsed = parseInput(input)
    if (parsed.kind === 'message') {
      if (!needPeer()) return
      if (await p.onSend(parsed.text)) setDraft('')
      return
    }
    setDraft('')
    push('cmd', input.trim())
    if (parsed.kind === 'unknown') push('err', `pairlan: comando não encontrado: /${parsed.name} (veja /help)`)
    else await run(parsed.name, parsed.arg)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      void submit()
      return
    }
    if (e.key === 'Tab') {
      const options = completeCommand(draft)
      if (options.length === 0) return
      e.preventDefault()
      if (options.length === 1) {
        setDraft(`${options[0]} `)
        setCompletions([])
      } else setCompletions(options)
      return
    }
    if (draft.startsWith('/')) return
    const now = Date.now()
    if (connected && now - lastTyping.current > 2000) {
      lastTyping.current = now
      api.sendTyping()
    }
  }

  const attach = async (files: File[]) => {
    if (files.length === 0 || !needPeer()) return
    p.onAttached(await sendFiles(files))
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = pastedFiles(e)
    if (files.length === 0) return
    e.preventDefault()
    void attach(files)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void attach([...e.dataTransfer.files])
  }

  const promptLine = (text: ReactNode) => (
    <p className="term-line">
      <span className="term-chev">❯</span> {text}
    </p>
  )

  const walkieText = walkieStatusText(p.walkie.state, p.walkie.peerLive)
  const tail: ReactNode[] = []
  if (!connected) {
    if (p.status.state === 'connecting') tail.push(<p key="s" className="term-line"><span className="term-warn">{spinner}</span> conectando…</p>)
    else if (p.searching) {
      tail.push(
        <p key="s" className="term-line">
          <span className="term-warn">{spinner}</span> procurando par na rede… <span className="term-dim">(/parar para pausar)</span>
        </p>,
        <p key="h1" className="term-line term-dim">  abra o pairlan no outro pc, na mesma rede.</p>,
        <p key="h2" className="term-line term-dim">  ou conecte direto: /conectar 192.168.0.12</p>
      )
    } else {
      tail.push(
        <p key="s" className="term-line">busca pausada. <span className="term-dim">você não aparece na rede.</span></p>,
        <p key="h1" className="term-line term-dim">  /buscar volta a procurar · /conectar &lt;ip&gt; conecta direto</p>
      )
    }
  } else {
    if (p.walkie.incoming) tail.push(<p key="v" className="term-line term-warn">-- {peerName} está falando…</p>)
    if (walkieText) tail.push(<p key="w" className="term-line term-warn">-- {walkieText.toLowerCase()}</p>)
    else if (p.peerTyping) tail.push(<p key="t" className="term-line term-dim">-- {peerName} está digitando…</p>)
  }

  const seg = (label: string, on: boolean, onClick: () => void, title: string, disabled = false) => (
    <button type="button" className={on ? 'term-seg on' : 'term-seg'} aria-pressed={on} title={title} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )

  const windows = configOpen ? '0:chat 1:config*' : showScreen ? '0:chat 1:tela*' : '0:chat*'
  const right = connected
    ? `${peerName} ${p.status.address ?? ''}${showScreen ? ' · vendo tela' : ''}`
    : p.status.state === 'connecting'
      ? 'conectando'
      : p.searching
        ? 'procurando'
        : 'offline'
  const talking = p.walkie.state === 'on-air' || p.walkie.state === 'recording'

  return (
    <main className="term-app">
      <div className={showScreen ? 'term-body split' : 'term-body'}>
        {showScreen && <ScreenView variant="terminal" stream={p.share.remoteStream} peerName={peerName} canControl={p.peerControl} />}
        <section
          className="term-chat"
          aria-label="Chat"
          onDragOver={(e) => {
            e.preventDefault()
            if (connected) setDragging(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragging(false)
          }}
          onDrop={onDrop}
          onClick={() => {
            if (!configOpen && !window.getSelection()?.toString()) inputRef.current?.focus()
          }}
        >
          <div className="term-log" ref={logRef} role="log" aria-live="polite" aria-label="Mensagens">
            <PowerLine path={p.config.terminalPath} branch={p.config.terminalBranch} />
            {promptLine('tail -f chat.log')}
            {feed.map((item) =>
              'msg' in item && item.msg ? (
                <TermMessage key={item.key} msg={item.msg} mine={item.msg.from === p.self.id} />
              ) : 'line' in item && item.line ? (
                item.line.kind === 'cmd' ? (
                  <div key={item.key}>{promptLine(item.line.text)}</div>
                ) : (
                  <p key={item.key} className={item.line.kind === 'err' ? 'term-line term-err' : 'term-line'}>
                    {item.line.text}
                    {item.line.action && (
                      <>
                        {' '}
                        <button type="button" className="term-link" onClick={item.line.action.run}>
                          {item.line.action.label.toLowerCase()}
                        </button>
                      </>
                    )}
                  </p>
                )
              ) : null
            )}
            {p.transfers.map((t) => (
              <p key={t.id} className="term-line">
                [anexo] {t.name} <span className="term-dim">{t.direction === 'out' ? 'enviando' : 'recebendo'}</span>{' '}
                <span className="term-warn">{progressBar(t.done, t.total)}</span>{' '}
                <span className="term-dim">
                  {formatBytes(t.done)}/{formatBytes(t.total)}
                </span>
              </p>
            ))}
            {tail}
          </div>

          {connected && p.systemAudio.incoming && (
            <p className="term-line term-audio">
              <span className="term-dim">audio:{peerName}</span>{' '}
              <button type="button" className="term-link" aria-label="Diminuir volume" onClick={() => p.systemAudio.setVolume(Math.max(0, p.systemAudio.volume - 0.1))}>
                -
              </button>{' '}
              {progressBar(p.systemAudio.volume * 100, 100).replace(/#/g, '█').replace(/\./g, '░')}{' '}
              <button type="button" className="term-link" aria-label="Aumentar volume" onClick={() => p.systemAudio.setVolume(Math.min(1, p.systemAudio.volume + 0.1))}>
                +
              </button>{' '}
              <button type="button" className="term-link" onClick={() => p.systemAudio.setMuted(!p.systemAudio.muted)}>
                {p.systemAudio.muted ? 'ouvir' : 'mudo'}
              </button>
              {p.ducked && <span className="term-dim"> (abaixado enquanto você fala)</span>}
            </p>
          )}

          <PowerLine path={p.config.terminalPath} branch={p.config.terminalBranch} />
          <label className="term-prompt">
            <span className="term-chev">❯ </span>
            <textarea
              ref={inputRef}
              className="term-input"
              aria-label="Mensagem ou comando"
              rows={Math.min(6, draft.split('\n').length)}
              value={draft}
              spellCheck={false}
              onChange={(e) => {
                setDraft(e.target.value)
                setCompletions([])
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
          </label>
          {completions.length > 0 && <p className="term-line term-dim term-hint">  {completions.join('  ')}</p>}

          {dragging && <div className="term-drop">-- solte para enviar --</div>}

          {configOpen && (
            <TermConfig
              config={p.config}
              onClose={() => setConfigOpen(false)}
              onChange={(patch) => void api.setConfig(patch)}
              onConnect={api.connectManual}
            />
          )}
        </section>
      </div>

      <footer className="term-status">
        <span className="term-status-name">[pair]</span>
        <span className="term-status-win">{windows}</span>
        {connected ? (
          <>
            {seg('tela', p.share.sharing, () => void run('tela', ''), '/tela — compartilhar minha tela')}
            {seg('audio', p.systemAudio.sharing, () => void run('audio', ''), '/audio — transmitir o áudio do PC', p.systemAudio.starting)}
            {seg('ouvir', p.config.liveAudio, () => void run('ouvir', ''), '/ouvir — voz do par toca na hora')}
            {p.share.sharing && seg('controle', p.controlAllowed, p.onToggleControl, '/controle — liberar meu mouse e teclado', p.controlBusy)}
          </>
        ) : (
          <>
            {seg('buscar', p.searching, () => api.setSearching(!p.searching), p.searching ? '/parar — parar de procurar' : '/buscar — procurar de novo')}
            {seg('conectar', false, () => {
              setDraft('/conectar ')
              inputRef.current?.focus()
            }, '/conectar — conectar por IP')}
          </>
        )}
        {talking && <span className="term-status-rec">● fala</span>}
        <span className="term-fill" />
        <span className="term-status-right">{right}</span>
        <span className="term-status-clock">{clock(Date.now())}</span>
      </footer>
    </main>
  )
}
