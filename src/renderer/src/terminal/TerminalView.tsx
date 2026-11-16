import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { AppConfig, InternetStatus, LinkStatus, TransferProgress, WifiDirectStatus } from '../../../shared/api'
import { normalizeUsername } from '../../../shared/relay'
import type { Note } from '../../../shared/notes'
import type { ChatMessage, PeerInfo } from '../../../shared/protocol'
import { pastedFiles, sendFiles } from '../files'
import { incomingText } from '../alerts'
import { formatBytes } from '../format'
import { internetSummary } from '../internet'
import { MessageMenu, type MenuAt } from '../MessageMenu'
import { HIT_LABEL, noteBody, parseHitArg, preview } from '../notes'
import { ScreenView } from '../ScreenView'
import type { SnackbarAction, SnackbarItem } from '../Snackbar'
import type { useAlerts } from '../useAlerts'
import type { useScreenShare } from '../useScreenShare'
import type { useSystemAudio } from '../useSystemAudio'
import { copyText, flashElement, type NotesApi } from '../useNotes'
import type { useWalkie } from '../useWalkie'
import { walkieStatusText } from '../WalkieButton'
import { completeCommand, helpText, parseInput, type CommandName } from './commands'
import { PowerLine } from './PowerLine'
import { TermConfig } from './TermConfig'
import { TermNotes } from './TermNotes'
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
  onRequestControl: () => void
  onSend: (text: string) => Promise<boolean>
  onAttached: (msgs: ChatMessage[]) => void
  onClearHistory: () => Promise<void>
  wifi: WifiDirectStatus
  internet: InternetStatus
  alerts: ReturnType<typeof useAlerts>
  notes: NotesApi
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
  const [notesQuery, setNotesQuery] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ msg: ChatMessage; at: MenuAt } | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(null)
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
    setLocal((prev) => [...prev, { id: ++seq.current, ts: Date.now(), kind: notice.tone === 'info' ? 'out' : 'err', text: `pairlan: ${notice.text}`, action: notice.action }])
    onDismissNotice()
  }, [notice, onDismissNotice])

  const seenAlert = p.alerts.outgoing?.seen === true
  useEffect(() => {
    if (seenAlert) setLocal((prev) => [...prev, { id: ++seq.current, ts: Date.now(), kind: 'out', text: `${peerName} viu o alerta.` }])
  }, [seenAlert, peerName])

  const feed = [
    ...p.messages.map((m) => ({ key: `m${m.id}`, ts: m.ts, msg: m })),
    ...local.map((l) => ({ key: `l${l.id}`, ts: l.ts, line: l }))
  ]
    .filter((item) => item.ts >= clearedAt)
    .sort((a, b) => a.ts - b.ts)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [feed.length, p.transfers.length, p.peerTyping, p.walkie.state])

  const notesOpen = notesQuery !== null
  const dialogOpen = configOpen || notesOpen

  useEffect(() => {
    if (!dialogOpen) inputRef.current?.focus()
  }, [dialogOpen])

  useEffect(() => {
    if (notesOpen || !jumpTo) return
    if (!flashElement(`tmsg-${jumpTo}`)) {
      setLocal((prev) => [...prev, { id: ++seq.current, ts: Date.now(), kind: 'err', text: 'pairlan: essa mensagem não está mais na tela (histórico apagado ou /limpar)' }])
    }
    setJumpTo(null)
  }, [notesOpen, jumpTo])

  const restoreAction = (note: Note) => ({ label: 'desfazer', run: () => void p.notes.restore(note).then(() => push('out', 'nota de volta.')) })

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
      case 'alerta': {
        if (!needPeer()) return
        const level = !arg || /^amarel/i.test(arg) ? 'yellow' : /^verm/i.test(arg) ? 'red' : null
        if (!level) return push('err', 'uso: /alerta  ou  /alerta vermelho')
        p.alerts.send(level)
        return push('out', `alerta ${level === 'red' ? 'vermelho' : 'amarelo'} enviado. aguardando ${peerName}…`)
      }
      case 'chacoalhar':
        if (!needPeer()) return
        p.alerts.send('shake')
        return push('out', `janela de ${peerName} chacoalhada.`)
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
      case 'direct': {
        if (p.wifi.state === 'unsupported') return push('err', 'pairlan: esta placa wi-fi não tem wi-fi direct')
        if (arg === 'off' || (!arg && (p.wifi.state === 'on' || p.wifi.state === 'connecting'))) {
          api.stopWifiDirect()
          return push('out', 'wi-fi direct desligado. voltando para a rede normal…')
        }
        if (!arg && !(connected && p.wifi.peer)) {
          return push('err', `uso: /direct mac-do-par   (o seu é ${p.wifi.self}; o par roda /direct ${p.wifi.self} junto)`)
        }
        const result = await api.startWifiDirect(arg || undefined)
        if (!result.ok) return push('err', `pairlan: ${result.error.toLowerCase()}`)
        return push('out', arg ? `ligando wi-fi direct com ${arg}… rode /direct ${p.wifi.self} no par agora.` : 'mudando para wi-fi direct… o par liga junto.')
      }
      case 'usuario': {
        if (!arg) {
          return push('out', p.internet.me ? `você é @${p.internet.me}. seu código: ${p.internet.myFingerprint}` : 'uso: /usuario seu_nome')
        }
        const result = await api.registerInternet(arg)
        if (!result.ok) return push('err', `pairlan: ${result.error.toLowerCase()}`)
        return push('out', `registrado como @${normalizeUsername(arg)}. seu código: ${p.internet.myFingerprint}`)
      }
      case 'par': {
        if (arg === 'off') {
          api.removeInternetPeer()
          return push('out', 'par da internet removido.')
        }
        if (!arg) {
          if (!p.internet.peer) return push('out', 'uso: /par usuario_do_par')
          return push('out', `par: @${p.internet.peer} · código ${p.internet.peerFingerprint}\n${internetSummary(p.internet).toLowerCase()}`)
        }
        const result = await api.addInternetPeer(arg)
        if (!result.ok) return push('err', `pairlan: ${result.error.toLowerCase()}`)
        return push('out', `par @${normalizeUsername(arg)} salvo. o par roda /par ${p.internet.me}. confira o código com /par.`)
      }
      case 'salvar': {
        const hit = parseHitArg(arg)
        if (hit === undefined) return push('err', 'uso: /salvar  ou  /salvar vermelho|amarelo|verde')
        const target = [...p.messages].reverse().find((m) => m.from !== p.self.id) ?? p.messages[p.messages.length - 1]
        if (!target) return push('err', 'pairlan: nenhuma mensagem para salvar')
        await p.notes.save(target, hit)
        const body = target.attachment ? `[anexo] ${target.attachment.name}` : target.text
        return push('out', `salvo nas notas${hit ? ` como hit ${HIT_LABEL[hit].toLowerCase()}` : ''}: "${preview(body)}"`)
      }
      case 'notas':
        return setNotesQuery(arg)
      case 'config':
        return setConfigOpen(true)
      case 'tema':
        void api.setConfig({ terminalMode: false })
        return
      case 'limpar':
        setLocal([])
        return setClearedAt(Date.now())
      case 'apagar':
        if (arg.toLowerCase() !== 'sim') {
          return push('out', 'isso apaga todo o histórico deste pc (o par continua com o dele).\nconfirme com: /apagar sim')
        }
        await p.onClearHistory()
        setLocal([])
        return push('out', 'histórico apagado.')
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
    if (p.alerts.incoming) {
      tail.push(
        <p key="a" className={`term-line term-alert ${p.alerts.incoming}`} role="alert">
          !! {incomingText(p.alerts.incoming, peerName).toLowerCase()}{' '}
          <button type="button" className="term-link" onClick={p.alerts.ack}>
            [vi]
          </button>
        </p>
      )
    }
    if (p.walkie.incoming) tail.push(<p key="v" className="term-line term-warn">-- {peerName} está falando…</p>)
    if (walkieText) tail.push(<p key="w" className="term-line term-warn">-- {walkieText.toLowerCase()}</p>)
    else if (p.peerTyping) tail.push(<p key="t" className="term-line term-dim">-- {peerName} está digitando…</p>)
  }

  const seg = (label: string, on: boolean, onClick: () => void, title: string, disabled = false) => (
    <button type="button" className={on ? 'term-seg on' : 'term-seg'} aria-pressed={on} title={title} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )

  const windows = configOpen ? '0:chat 1:config*' : notesOpen ? '0:chat 1:notas*' : showScreen ? '0:chat 1:tela*' : '0:chat*'
  const right = connected
    ? `${peerName} ${p.status.state === 'connected' && p.status.via === 'internet' ? 'internet' : (p.status.address ?? '')}${showScreen ? ' · vendo tela' : ''}`
    : p.status.state === 'connecting'
      ? 'conectando'
      : p.searching
        ? 'procurando'
        : 'offline'
  const talking = p.walkie.state === 'on-air' || p.walkie.state === 'recording'

  return (
    <main
      className={[
        'term-app',
        p.alerts.incoming && p.alerts.incoming !== 'shake' ? `alert-${p.alerts.incoming}` : '',
        p.alerts.shaking ? 'shaking' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={showScreen ? 'term-body split' : 'term-body'}>
        {showScreen && <ScreenView variant="terminal" stream={p.share.remoteStream} peerName={peerName} canControl={p.peerControl} onRequestControl={p.onRequestControl} />}
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
            if (!dialogOpen && !window.getSelection()?.toString()) inputRef.current?.focus()
          }}
        >
          <div className="term-log" ref={logRef} role="log" aria-live="polite" aria-label="Mensagens">
            <PowerLine path={p.config.terminalPath} branch={p.config.terminalBranch} />
            {promptLine('tail -f chat.log')}
            {feed.map((item) =>
              'msg' in item && item.msg ? (
                <TermMessage
                  key={item.key}
                  msg={item.msg}
                  mine={item.msg.from === p.self.id}
                  note={p.notes.byMessage.get(item.msg.id)}
                  onMenu={(at) => item.msg && setMenu({ msg: item.msg, at })}
                />
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

          {menu && (
            <MessageMenu
              variant="term"
              at={menu.at}
              note={p.notes.byMessage.get(menu.msg.id)}
              onSave={() => void p.notes.save(menu.msg).then(() => push('out', 'salvo nas notas. /notas abre.'))}
              onUnsave={() => {
                const note = p.notes.byMessage.get(menu.msg.id)
                if (note) void p.notes.remove(note.id).then(() => push('out', 'removido das notas.', restoreAction(note)))
              }}
              onHit={(hit) => {
                const was = p.notes.byMessage.get(menu.msg.id)?.hit
                void p.notes.toggleHit(menu.msg, hit).then(() => push('out', was === hit ? 'hit removido.' : `salvo como hit ${HIT_LABEL[hit].toLowerCase()}.`))
              }}
              onCopy={() => void copyText(menu.msg.attachment ? menu.msg.attachment.name : menu.msg.text).then((ok) => push(ok ? 'out' : 'err', ok ? 'copiado.' : 'pairlan: não deu para copiar'))}
              onClose={() => setMenu(null)}
            />
          )}

          {notesOpen && (
            <TermNotes
              notes={p.notes.notes}
              selfId={p.self.id}
              initialQuery={notesQuery}
              onClose={() => setNotesQuery(null)}
              onShow={(id) => {
                setJumpTo(id)
                setNotesQuery(null)
              }}
              onHit={(id, hit) => void p.notes.setHit(id, hit)}
              onComment={(id, comment) => void p.notes.setComment(id, comment)}
              onRemove={(note) => void p.notes.remove(note.id)}
              onRestore={(note) => void p.notes.restore(note)}
              onCopy={(note) => copyText(noteBody(note))}
            />
          )}

          {configOpen && (
            <TermConfig
              config={p.config}
              onClose={() => setConfigOpen(false)}
              onChange={(patch) => void api.setConfig(patch)}
              onConnect={api.connectManual}
              onClearHistory={async () => {
                await p.onClearHistory()
                setLocal([])
                push('out', 'histórico apagado.')
              }}
              wifi={p.wifi}
              internet={p.internet}
              connected={connected}
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
            {seg('alerta', p.alerts.outgoing !== null && !p.alerts.outgoing.seen, () => void run('alerta', ''), '/alerta — chamar atenção do par')}
            {p.wifi.state !== 'unsupported' &&
              seg('direct', p.wifi.state === 'on', () => void run('direct', ''), '/direct — wi-fi direct', p.wifi.state === 'connecting')}
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
        {seg(`notas ${p.notes.notes.length}`, notesOpen, () => setNotesQuery(notesOpen ? null : ''), '/notas — abrir as notas')}
        {talking && <span className="term-status-rec">● fala</span>}
        <span className="term-fill" />
        <span className="term-status-right">{right}</span>
        <span className="term-status-clock">{clock(Date.now())}</span>
      </footer>
    </main>
  )
}
