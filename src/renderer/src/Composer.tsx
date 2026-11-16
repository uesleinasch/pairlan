import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { pastedFiles } from './files'
import { htmlToMarkdown, markdownToHtml } from './markdown'
import type { WalkieState } from './useWalkie'
import { WalkieButton } from './WalkieButton'

type Walkie = {
  state: WalkieState
  peerLive: boolean
  startTalking: () => Promise<void>
  stopTalking: () => Promise<void>
}

type Props = {
  connected: boolean
  placeholder: string
  walkie: Walkie
  onSend: (text: string) => Promise<boolean>
  onAttach: () => void
  onFiles: (files: File[]) => void
  onTyping: () => void
}

type Format = 'bold' | 'italic' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList'

const FORMATS: { cmd: Format; icon: string; label: string }[] = [
  { cmd: 'bold', icon: 'format_bold', label: 'Negrito (Ctrl+B)' },
  { cmd: 'italic', icon: 'format_italic', label: 'Itálico (Ctrl+I)' },
  { cmd: 'strikeThrough', icon: 'strikethrough_s', label: 'Riscado' },
  { cmd: 'insertUnorderedList', icon: 'format_list_bulleted', label: 'Lista' },
  { cmd: 'insertOrderedList', icon: 'format_list_numbered', label: 'Lista numerada' }
]

const RICH_KEY = 'pairlan.richComposer'
const MAX_FIELD_PX = 160

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const readRich = () => {
  try {
    return localStorage.getItem(RICH_KEY) === '1'
  } catch {
    return false
  }
}

export function Composer(p: Props) {
  const [rich, setRich] = useState(readRich)
  const [draft, setDraft] = useState('')
  const [richEmpty, setRichEmpty] = useState(true)
  const [active, setActive] = useState<Partial<Record<Format, boolean>>>({})
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const editor = useRef<HTMLDivElement>(null)
  const seed = useRef('')
  const range = useRef<Range | null>(null)
  const lastTyping = useRef(0)

  const typing = () => {
    const now = Date.now()
    if (now - lastTyping.current > 2000) {
      lastTyping.current = now
      p.onTyping()
    }
  }

  useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_PX)}px`
  }, [draft, rich])

  useLayoutEffect(() => {
    if (!rich) {
      field.current?.focus()
      return
    }
    const el = editor.current
    if (!el) return
    el.innerHTML = markdownToHtml(seed.current)
    seed.current = ''
    setRichEmpty(!el.textContent)
    el.focus()
    const sel = window.getSelection()
    sel?.selectAllChildren(el)
    sel?.collapseToEnd()
  }, [rich])

  const refreshActive = useCallback(() => {
    if (!editor.current?.contains(document.getSelection()?.anchorNode ?? null)) return
    setActive(Object.fromEntries(FORMATS.map((f) => [f.cmd, document.queryCommandState(f.cmd)])))
  }, [])

  useEffect(() => {
    if (!rich) return
    document.addEventListener('selectionchange', refreshActive)
    return () => document.removeEventListener('selectionchange', refreshActive)
  }, [rich, refreshActive])

  const toggleRich = () => {
    if (rich) setDraft(editor.current ? htmlToMarkdown(editor.current) : '')
    else seed.current = draft
    setLinkUrl(null)
    setRich(!rich)
    try {
      localStorage.setItem(RICH_KEY, rich ? '0' : '1')
    } catch {
      return
    }
  }

  const submit = async () => {
    if (!p.connected) return
    const text = rich ? (editor.current ? htmlToMarkdown(editor.current) : '') : draft
    if (!text.trim() || !(await p.onSend(text))) return
    if (rich && editor.current) {
      editor.current.innerHTML = ''
      setRichEmpty(true)
      editor.current.focus()
    } else setDraft('')
  }

  const run = (cmd: string, value?: string) => {
    editor.current?.focus()
    document.execCommand(cmd, false, value)
    refreshActive()
    setRichEmpty(!editor.current?.textContent)
  }

  const selected = () => window.getSelection()?.toString() ?? ''

  const insertCode = () => run('insertHTML', `<code>${esc(selected() || 'código')}</code>&#8203;`)
  const insertBlock = () => run('insertHTML', `<pre>${esc(selected() || ' ')}</pre><div><br></div>`)

  const openLink = () => {
    const sel = window.getSelection()
    range.current = sel && sel.rangeCount && editor.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
    setLinkUrl(/^https?:\/\//.test(selected()) ? selected() : 'https://')
  }

  const applyLink = () => {
    const raw = (linkUrl ?? '').trim()
    setLinkUrl(null)
    const url = /^https?:\/\//i.test(raw) ? raw : raw && !raw.includes(' ') ? `https://${raw}` : ''
    editor.current?.focus()
    const sel = window.getSelection()
    if (range.current && sel) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
    if (!url || url === 'https://') return
    if (sel?.isCollapsed ?? true) run('insertHTML', `<a href="${esc(url)}">${esc(url)}</a>&#8203;`)
    else run('createLink', url)
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = pastedFiles(e)
    if (files.length) {
      e.preventDefault()
      p.onFiles(files)
      return
    }
    if (!rich) return
    e.preventDefault()
    run('insertText', e.clipboardData.getData('text/plain'))
  }

  const onFieldKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      void submit()
      return
    }
    typing()
  }

  const onEditorKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      void submit()
      return
    }
    typing()
  }

  const canSend = p.connected && (rich ? !richEmpty : draft.trim() !== '')

  const attach = (
    <md-icon-button onClick={p.onAttach} disabled={!p.connected} aria-label="Anexar arquivo" title="Anexar arquivo (ou arraste / cole)">
      <md-icon>attach_file</md-icon>
    </md-icon-button>
  )
  const formatToggle = (
    <md-icon-button
      className={rich ? 'format-toggle on' : 'format-toggle'}
      onClick={toggleRich}
      aria-pressed={rich}
      aria-label={rich ? 'Voltar para a caixa simples' : 'Formatar texto'}
      title={rich ? 'Voltar para a caixa simples' : 'Formatar (texto rico)'}
    >
      <md-icon>text_format</md-icon>
    </md-icon-button>
  )
  const send = (
    <md-filled-icon-button onClick={() => void submit()} disabled={!canSend} aria-label="Enviar" title={rich ? 'Enviar (Ctrl+Enter)' : 'Enviar (Enter)'}>
      <md-icon>send</md-icon>
    </md-filled-icon-button>
  )
  const walkie = (
    <WalkieButton
      state={p.walkie.state}
      peerLive={p.walkie.peerLive}
      disabled={!p.connected}
      onStart={() => void p.walkie.startTalking()}
      onStop={() => void p.walkie.stopTalking()}
    />
  )

  if (!rich) {
    return (
      <div className="composer">
        {attach}
        <div className="composer-box">
          <textarea
            ref={field}
            className="composer-input type-body-large"
            rows={1}
            value={draft}
            aria-label="Mensagem"
            placeholder={p.placeholder}
            spellCheck
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onFieldKey}
            onPaste={onPaste}
          />
          {formatToggle}
        </div>
        {send}
        {walkie}
      </div>
    )
  }

  return (
    <div className="composer rich">
      <div className="composer-box rich">
        <div className="format-bar" role="toolbar" aria-label="Formatação">
          {FORMATS.map((f, i) => (
            <span key={f.cmd} className="format-group">
              {i === 3 && <span className="format-sep" aria-hidden="true" />}
              <button
                type="button"
                className={active[f.cmd] ? 'format-btn on' : 'format-btn'}
                aria-pressed={Boolean(active[f.cmd])}
                aria-label={f.label}
                title={f.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(f.cmd)}
              >
                <md-icon>{f.icon}</md-icon>
              </button>
            </span>
          ))}
          <span className="format-sep" aria-hidden="true" />
          <button type="button" className="format-btn" aria-label="Código" title="Código" onMouseDown={(e) => e.preventDefault()} onClick={insertCode}>
            <md-icon>code</md-icon>
          </button>
          <button type="button" className="format-btn" aria-label="Bloco de código" title="Bloco de código" onMouseDown={(e) => e.preventDefault()} onClick={insertBlock}>
            <md-icon>data_object</md-icon>
          </button>
          <button type="button" className="format-btn" aria-label="Link" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={openLink}>
            <md-icon>link</md-icon>
          </button>
        </div>
        {linkUrl !== null && (
          <div className="link-row">
            <input
              className="type-body-medium"
              value={linkUrl}
              aria-label="Endereço do link"
              autoFocus
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setLinkUrl(null)
                  editor.current?.focus()
                }
              }}
            />
            <md-text-button onClick={applyLink}>Inserir</md-text-button>
          </div>
        )}
        <div
          ref={editor}
          className={richEmpty ? 'rich-editor type-body-large empty' : 'rich-editor type-body-large'}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Mensagem formatada"
          data-placeholder={p.placeholder}
          spellCheck
          onInput={() => setRichEmpty(!editor.current?.textContent)}
          onKeyDown={onEditorKey}
          onPaste={onPaste}
          onDrop={(e) => e.preventDefault()}
        />
        <div className="composer-actions">
          {attach}
          {formatToggle}
          <span className="composer-hint type-body-small">Enter quebra linha · Ctrl+Enter envia</span>
          {send}
          {walkie}
        </div>
      </div>
    </div>
  )
}
