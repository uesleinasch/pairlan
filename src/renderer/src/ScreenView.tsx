import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { videoPoint, wheelSteps, type Point } from './pointer'

const api = window.pairlan

type Mode = 'view' | 'laser' | 'control'

type Props = {
  stream: MediaStream | null
  peerName: string
  canControl: boolean
}

const pointOf = (e: PointerEvent<HTMLVideoElement>): Point | null => {
  const v = e.currentTarget
  return videoPoint(v.getBoundingClientRect(), v.videoWidth, v.videoHeight, e.clientX, e.clientY)
}

export function ScreenView({ stream, peerName, canControl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLElement>(null)
  const [actualSize, setActualSize] = useState(false)
  const [mode, setMode] = useState<Mode>('view')
  const pending = useRef<Point | null>(null)
  const frame = useRef(0)
  const heldKeys = useRef(new Set<string>())
  const heldButtons = useRef(new Set<number>())

  const activeMode: Mode = mode === 'control' && !canControl ? 'view' : mode

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    if (activeMode === 'view') return
    const video = videoRef.current
    if (activeMode === 'control') video?.focus()
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const dx = wheelSteps(e.deltaX, e.deltaMode)
      const dy = wheelSteps(e.deltaY, e.deltaMode)
      if (dx || dy) api.sendInput({ kind: 'scroll', dx, dy })
    }
    if (activeMode === 'control') video?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      video?.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      if (activeMode === 'laser') api.sendLaser(null)
      else releaseAll()
    }
  }, [activeMode])

  const releaseAll = () => {
    heldKeys.current.forEach((code) => api.sendInput({ kind: 'key', code, down: false }))
    heldButtons.current.forEach((button) => api.sendInput({ kind: 'button', button, down: false }))
    heldKeys.current.clear()
    heldButtons.current.clear()
  }

  const sendPoint = (p: Point | null) => {
    if (activeMode === 'laser') api.sendLaser(p ? { ...p, click: false } : null)
    else if (p) api.sendInput({ kind: 'move', ...p })
  }

  const onPointerMove = (e: PointerEvent<HTMLVideoElement>) => {
    if (activeMode === 'view') return
    pending.current = pointOf(e)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      sendPoint(pending.current)
    })
  }

  const onPointerDown = (e: PointerEvent<HTMLVideoElement>) => {
    const p = pointOf(e)
    if (activeMode === 'laser' && p) api.sendLaser({ ...p, click: true })
    if (activeMode !== 'control') return
    e.preventDefault()
    e.currentTarget.focus()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (p) api.sendInput({ kind: 'move', ...p })
    heldButtons.current.add(e.button)
    api.sendInput({ kind: 'button', button: e.button, down: true })
  }

  const onPointerUp = (e: PointerEvent<HTMLVideoElement>) => {
    if (activeMode !== 'control' || !heldButtons.current.delete(e.button)) return
    const p = pointOf(e)
    if (p) api.sendInput({ kind: 'move', ...p })
    api.sendInput({ kind: 'button', button: e.button, down: false })
  }

  const onKey = (down: boolean) => (e: KeyboardEvent<HTMLVideoElement>) => {
    if (activeMode !== 'control') return
    e.preventDefault()
    e.stopPropagation()
    if (e.repeat || !e.code) return
    if (down) heldKeys.current.add(e.code)
    else if (!heldKeys.current.delete(e.code)) return
    api.sendInput({ kind: 'key', code: e.code, down })
  }

  const toggle = (next: Mode) => setMode((current) => (current === next ? 'view' : next))

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void boxRef.current?.requestFullscreen()
  }

  const LaserButton = activeMode === 'laser' ? 'md-filled-icon-button' : 'md-icon-button'
  const ControlButton = activeMode === 'control' ? 'md-filled-icon-button' : 'md-icon-button'
  const controlTitle = !canControl
    ? `${peerName} não liberou o controle`
    : activeMode === 'control'
      ? 'Parar de controlar'
      : `Controlar mouse e teclado de ${peerName}`

  return (
    <section className="card screen" ref={boxRef} aria-label={`Tela de ${peerName}`}>
      <header className="card-header">
        <md-icon aria-hidden="true">desktop_windows</md-icon>
        <span className="type-title-small">Tela de {peerName}</span>
        <LaserButton
          onClick={() => toggle('laser')}
          aria-pressed={activeMode === 'laser'}
          aria-label={activeMode === 'laser' ? 'Desligar laser' : 'Laser: apontar na tela do par'}
          title={activeMode === 'laser' ? 'Desligar laser' : 'Laser: apontar na tela do par'}
        >
          <md-icon>stylus_laser_pointer</md-icon>
        </LaserButton>
        <ControlButton
          onClick={() => toggle('control')}
          disabled={!canControl}
          aria-pressed={activeMode === 'control'}
          aria-label={controlTitle}
          title={controlTitle}
        >
          <md-icon>mouse</md-icon>
        </ControlButton>
        <md-icon-button
          onClick={() => setActualSize((v) => !v)}
          aria-label={actualSize ? 'Ajustar à janela' : 'Tamanho real'}
          title={actualSize ? 'Ajustar à janela' : 'Tamanho real (100%)'}
        >
          <md-icon>{actualSize ? 'fit_screen' : 'crop_free'}</md-icon>
        </md-icon-button>
        <md-icon-button onClick={fullscreen} aria-label="Tela cheia" title="Tela cheia">
          <md-icon>fullscreen</md-icon>
        </md-icon-button>
      </header>
      <div className={actualSize ? 'screen-video actual' : 'screen-video'}>
        {stream ? (
          <video
            ref={videoRef}
            className={activeMode === 'view' ? undefined : activeMode}
            tabIndex={activeMode === 'control' ? 0 : -1}
            autoPlay
            muted
            playsInline
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={() => activeMode === 'laser' && api.sendLaser(null)}
            onKeyDown={onKey(true)}
            onKeyUp={onKey(false)}
            onBlur={() => activeMode === 'control' && releaseAll()}
            onContextMenu={(e) => activeMode === 'control' && e.preventDefault()}
          />
        ) : (
          <md-linear-progress indeterminate aria-label="Conectando vídeo" />
        )}
      </div>
    </section>
  )
}
