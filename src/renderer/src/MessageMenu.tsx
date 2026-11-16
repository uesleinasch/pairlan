import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { HIT_LEVELS, type HitLevel, type Note } from '../../shared/notes'
import { HIT_LABEL } from './notes'

export type MenuAt = { x: number; y: number }

type Props = {
  variant: 'm3' | 'term'
  at: MenuAt
  note: Note | undefined
  onSave: () => void
  onUnsave: () => void
  onHit: (hit: HitLevel) => void
  onCopy: () => void
  onClose: () => void
}

const KEYS: Record<string, 'save' | HitLevel | 'copy'> = { s: 'save', '1': 'red', '2': 'yellow', '3': 'green', c: 'copy' }

export function MessageMenu({ variant, at, note, onSave, onUnsave, onHit, onCopy, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: at.x, top: at.y })
  const close = useRef(onClose)
  close.current = onClose

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.max(4, Math.min(at.x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(at.y, window.innerHeight - height - 4))
    })
    el.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true })
  }, [at.x, at.y])

  useEffect(() => {
    const dismiss = () => close.current()
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) dismiss()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('blur', dismiss)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [])

  const act = (action: 'save' | HitLevel | 'copy') => {
    if (action === 'save') (note ? onUnsave : onSave)()
    else if (action === 'copy') onCopy()
    else onHit(action)
    onClose()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (step) {
      e.preventDefault()
      items[(at + step + items.length) % items.length]?.focus()
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      onClose()
    } else if (KEYS[e.key.toLowerCase()] && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      act(KEYS[e.key.toLowerCase()])
    }
    e.stopPropagation()
  }

  const saveLabel = note ? 'Remover das notas' : 'Salvar nas notas'

  if (variant === 'term') {
    const row = (label: string, key: string) => `${label.padEnd(21)}${key}`
    return (
      <div ref={ref} className="term-menu" role="menu" aria-label="Ações da mensagem" style={pos} onKeyDown={onKeyDown}>
        <span className="term-menu-title">┤ mensagem ├</span>
        <button type="button" role="menuitem" className="term-opt" onClick={() => act('save')}>
          {row(saveLabel.toLowerCase(), 's')}
        </button>
        {HIT_LEVELS.map((level, i) => (
          <button key={level} type="button" role="menuitemradio" aria-checked={note?.hit === level} className="term-opt" onClick={() => act(level)}>
            hit <span className={`term-hit ${level}`}>●</span> {`${HIT_LABEL[level].toLowerCase()}${note?.hit === level ? ' *' : ''}`.padEnd(15)}
            {i + 1}
          </button>
        ))}
        <button type="button" role="menuitem" className="term-opt" onClick={() => act('copy')}>
          {row('copiar texto', 'c')}
        </button>
        <p className="term-dim">↑/↓ escolhe · enter · esc</p>
      </div>
    )
  }

  return (
    <div ref={ref} className="msg-menu" role="menu" aria-label="Ações da mensagem" style={pos} onKeyDown={onKeyDown}>
      <button type="button" role="menuitem" className="msg-menu-item type-body-large" onClick={() => act('save')}>
        <md-icon aria-hidden="true">{note ? 'bookmark_remove' : 'bookmark_add'}</md-icon>
        {saveLabel}
      </button>
      <div className="msg-menu-hits type-body-large" role="group" aria-label="Hit">
        <span>Hit</span>
        {HIT_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="menuitemradio"
            aria-checked={note?.hit === level}
            aria-label={`Hit ${HIT_LABEL[level].toLowerCase()}`}
            title={note?.hit === level ? `Tirar hit ${HIT_LABEL[level].toLowerCase()}` : `Hit ${HIT_LABEL[level].toLowerCase()}`}
            className={`hit-dot ${level}`}
            onClick={() => act(level)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="msg-menu-divider" role="separator" />
      <button type="button" role="menuitem" className="msg-menu-item type-body-large" onClick={() => act('copy')}>
        <md-icon aria-hidden="true">content_copy</md-icon>
        Copiar texto
      </button>
    </div>
  )
}
