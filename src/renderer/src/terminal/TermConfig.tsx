import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AppConfig } from '../../../shared/api'

type Props = {
  config: AppConfig
  onClose: () => void
  onChange: (patch: Partial<AppConfig>) => void
  onConnect: (address: string) => Promise<boolean>
  onClearHistory: () => Promise<void>
}

const MIN_OPACITY = 0.3

const bar = (value: number) => {
  const filled = Math.round(value * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round(value * 100)}%`
}

export function TermConfig({ config, onClose, onChange, onConnect, onClearHistory }: Props) {
  const [name, setName] = useState(config.name)
  const [path, setPath] = useState(config.terminalPath)
  const [branch, setBranch] = useState(config.terminalBranch)
  const [address, setAddress] = useState(config.manualPeer)
  const [addressError, setAddressError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('input, button')?.focus()
  }, [])

  const stepOpacity = (delta: number) => {
    const next = Math.round(Math.min(1, Math.max(MIN_OPACITY, config.opacity + delta)) * 10) / 10
    if (next !== config.opacity) onChange({ opacity: next })
  }

  const connect = async () => {
    const ok = await onConnect(address)
    setAddressError(ok ? '' : 'ip inválido ou fora da rede local. ex.: 192.168.0.10')
    if (ok) onClose()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const toggle = (key: 'alwaysOnTop' | 'notifyMinimized' | 'terminalMode', label: string) => (
    <button type="button" className="term-opt" aria-pressed={config[key]} onClick={() => onChange({ [key]: !config[key] })}>
      [{config[key] ? 'x' : ' '}] {label}
    </button>
  )

  return (
    <div className="term-dialog-backdrop" onKeyDown={onKeyDown}>
      <div className="term-dialog" role="dialog" aria-modal="true" aria-label="Configurações" ref={box}>
        <span className="term-dialog-title">┤ pairlan config ├</span>

        <p className="term-dim">─ perfil</p>
        <label className="term-field">
          <span>nome</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => onChange({ name })} />
        </label>

        <p className="term-dim">─ conexão</p>
        <label className="term-field">
          <span>ip do par</span>
          <input
            value={address}
            placeholder="192.168.0.12"
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void connect()
            }}
          />
        </label>
        {addressError && <p className="term-err">{addressError}</p>}

        <p className="term-dim">─ janela</p>
        <div className="term-field">
          <span>opacidade</span>
          <span>
            <button type="button" className="term-link" aria-label="Menos opaco" onClick={() => stepOpacity(-0.1)}>
              -
            </button>{' '}
            {bar(config.opacity)}{' '}
            <button type="button" className="term-link" aria-label="Mais opaco" onClick={() => stepOpacity(0.1)}>
              +
            </button>
          </span>
        </div>
        <div className="term-opts">
          {toggle('alwaysOnTop', 'sempre no topo')}
          {toggle('notifyMinimized', 'notificar quando minimizado')}
          {toggle('terminalMode', 'modo terminal')}
        </div>

        <p className="term-dim">─ disfarce</p>
        <label className="term-field">
          <span>pasta</span>
          <input value={path} maxLength={60} onChange={(e) => setPath(e.target.value)} onBlur={() => onChange({ terminalPath: path })} />
        </label>
        <label className="term-field">
          <span>branch</span>
          <input value={branch} maxLength={40} onChange={(e) => setBranch(e.target.value)} onBlur={() => onChange({ terminalBranch: branch })} />
        </label>
        <p className="term-dim">    a pasta também vira o título da janela</p>

        <p className="term-dim">─ histórico</p>
        {confirmClear ? (
          <p>
            apagar todo o histórico deste pc?{' '}
            <button type="button" className="term-link term-danger" onClick={() => void onClearHistory().then(() => setConfirmClear(false))}>
              sim, apagar
            </button>{' '}
            <button type="button" className="term-link" onClick={() => setConfirmClear(false)}>
              cancelar
            </button>
          </p>
        ) : (
          <button type="button" className="term-opt" onClick={() => setConfirmClear(true)}>
            [apagar histórico]
          </button>
        )}

        <p className="term-dim">─ atalhos</p>
        <pre className="term-pre">{'  Ctrl+Espaço   falar (walkie)\n  Enter         enviar\n  Tab           completar comando\n  Esc           fechar esta janela'}</pre>

        <div className="term-dialog-actions">
          <button type="button" className="term-act" onClick={onClose}>
            &lt; Fechar &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
