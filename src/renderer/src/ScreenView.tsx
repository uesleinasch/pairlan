import { useEffect, useRef, useState } from 'react'

export function ScreenView({ stream, peerName }: { stream: MediaStream | null; peerName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [actualSize, setActualSize] = useState(false)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void boxRef.current?.requestFullscreen()
  }

  return (
    <section className="screen" ref={boxRef}>
      <div className="screen-tools">
        <span>Tela de {peerName}</span>
        <button className="ghost" onClick={() => setActualSize((v) => !v)}>
          {actualSize ? 'Ajustar' : '100%'}
        </button>
        <button className="ghost" onClick={fullscreen}>
          Tela cheia
        </button>
      </div>
      <div className={actualSize ? 'screen-video actual' : 'screen-video'}>
        {stream ? <video ref={videoRef} autoPlay muted playsInline /> : <p className="empty">Conectando vídeo…</p>}
      </div>
    </section>
  )
}
