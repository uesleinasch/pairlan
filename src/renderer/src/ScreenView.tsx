import { useEffect, useRef, useState } from 'react'

export function ScreenView({ stream, peerName }: { stream: MediaStream | null; peerName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLElement>(null)
  const [actualSize, setActualSize] = useState(false)

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
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <md-linear-progress indeterminate aria-label="Conectando vídeo" />
        )}
      </div>
    </section>
  )
}
