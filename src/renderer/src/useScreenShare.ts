import { useCallback, useEffect, useRef, useState } from 'react'
import { channelOf, type SignalPayload } from '../../shared/protocol'
import { RtcSession } from './rtc'

const api = window.pairlan

export function useScreenShare(connected: boolean) {
  const [sharing, setSharing] = useState(false)
  const [remoteSharing, setRemoteSharing] = useState(false)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')
  const sharer = useRef<{ session: RtcSession; stream: MediaStream } | null>(null)
  const viewer = useRef<RtcSession | null>(null)

  const stopSharing = useCallback((notify = true) => {
    const current = sharer.current
    sharer.current = null
    if (!current) return
    current.stream.getTracks().forEach((t) => t.stop())
    current.session.close()
    if (notify) {
      api.sendSignal({ role: 'sharer', kind: 'stop' })
      api.setSharing(false)
    }
    setSharing(false)
  }, [])

  const closeViewer = useCallback(() => {
    viewer.current?.close()
    viewer.current = null
    setRemoteStream(null)
  }, [])

  const startSharing = useCallback(async () => {
    if (sharer.current) return
    setError('')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false
      })
    } catch {
      setError('Compartilhamento cancelado.')
      return
    }
    const track = stream.getVideoTracks()[0]
    track.contentHint = 'detail'
    track.addEventListener('ended', () => stopSharing())
    const { width, height } = track.getSettings()
    api.setShareCapture(width && height ? { width, height } : null)
    const session = new RtcSession('sharer', api.sendSignal)
    session.pc.addTrack(track, stream)
    sharer.current = { session, stream }
    setSharing(true)
    api.setSharing(true)
    await session.offer()
  }, [stopSharing])

  useEffect(() => {
    const onSignal = async (p: SignalPayload) => {
      if (channelOf(p) !== 'screen') return
      if (p.role === 'viewer') {
        const session = sharer.current?.session
        if (!session) return
        if (p.kind === 'answer') {
          await session.setRemote('answer', p.sdp)
          await session.tuneSenders()
        } else if (p.kind === 'ice') {
          await session.addIce(p.candidate)
        }
        return
      }
      if (p.kind === 'offer') {
        closeViewer()
        const session = new RtcSession('viewer', api.sendSignal)
        session.pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]))
        viewer.current = session
        await session.setRemote('offer', p.sdp)
        await session.answer()
      } else if (p.kind === 'ice') {
        await viewer.current?.addIce(p.candidate)
      } else if (p.kind === 'stop') {
        closeViewer()
      }
    }
    const offs = [
      api.onSignal((p) => void onSignal(p).catch((err) => console.warn('[rtc]', err))),
      api.onRemoteSharing(setRemoteSharing)
    ]
    return () => offs.forEach((off) => off())
  }, [closeViewer])

  useEffect(() => {
    if (connected) return
    stopSharing(false)
    closeViewer()
    setRemoteSharing(false)
  }, [connected, stopSharing, closeViewer])

  return { sharing, remoteSharing, remoteStream, error, startSharing, stopSharing }
}
