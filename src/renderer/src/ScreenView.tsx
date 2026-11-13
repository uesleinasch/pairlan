import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { videoPoint, type Point } from './pointer'

const api = window.pairlan

const pointOf = (e: PointerEvent<HTMLVideoElement>): Point | null => {
  const v = e.currentTarget
  return videoPoint(v.getBoundingClientRect(), v.videoWidth, v.videoHeight, e.clientX, e.clientY)
}

export function ScreenView({ stream, peerName }: { stream: MediaStream | null; peerName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLElement>(null)
  const [actualSize, setActualSize] = useState(false)
  const [laser, setLaser] = useState(false)
  const pending = useRef<Point | null>(null)
  const frame = useRef(0)

  useEffect(() => {
    if (!laser) return
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      api.sendLaser(null)
    }
  }, [laser])

  const onPointerMove = (e: PointerEvent<HTMLVideoElement>) => {
    if (!laser) return
    pending.current = pointOf(e)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const p = pending.current
      api.sendLaser(p ? { ...p, click: false } : null)
    })
  }

  const onPointerDown = (e: PointerEvent<HTMLVideoElement>) => {
    const p = laser ? pointOf(e) : null
    if (p) api.sendLaser({ ...p, click: true })
  }

  const onPointerLeave = () => {
    if (laser) api.sendLaser(null)
  }

  const LaserButton = laser ? 'md-filled-icon-button' : 'md-icon-button'

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void boxRef.current?.requestFullscreen()
  }

  return (
    <section className="card screen" ref={boxRef} aria-label={`Tela de ${peerName}`}>
      <header className="card-header">
        <md-icon aria-hidden="true">desktop_windows</md-icon>
        <span className="type-title-small">Tela de {peerName}</span>
        <LaserButton
          onClick={() => setLaser((v) => !v)}
          aria-pressed={laser}
          aria-label={laser ? 'Desligar laser' : 'Laser: apontar na tela do par'}
          title={laser ? 'Desligar laser' : 'Laser: apontar na tela do par'}
        >
          <md-icon>stylus_laser_pointer</md-icon>
        </LaserButton>
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
            className={laser ? 'laser' : undefined}
            autoPlay
            muted
            playsInline
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            onPointerLeave={onPointerLeave}
          />
        ) : (
          <md-linear-progress indeterminate aria-label="Conectando vídeo" />
        )}
      </div>
    </section>
  )
}
