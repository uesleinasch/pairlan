import { useCallback, useEffect, useRef, useState } from 'react'
import { channelOf, type SignalPayload } from '../../shared/protocol'
import { RtcSession } from './rtc'

const api = window.pairlan

async function findInput(label: string): Promise<string | null> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
    const match = inputs.find((d) => d.label === label)
    if (match) return match.deviceId
    if (inputs.every((d) => !d.label)) {
      const unlock = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      unlock?.getTracks().forEach((t) => t.stop())
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

export function useSystemAudio(connected: boolean, liveAudio: boolean, ducked: boolean) {
  const [sharing, setSharing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [incoming, setIncoming] = useState(false)
  const [muted, setMuted] = useState(!liveAudio)
  const [volume, setVolume] = useState(1)
  const [error, setError] = useState('')
  const sender = useRef<{ session: RtcSession; stream: MediaStream } | null>(null)
  const receiver = useRef<RtcSession | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const liveAudioRef = useRef(liveAudio)
  liveAudioRef.current = liveAudio

  const stop = useCallback((notify = true) => {
    const current = sender.current
    sender.current = null
    api.stopSystemAudio()
    setSharing(false)
    if (!current) return
    current.stream.getTracks().forEach((t) => t.stop())
    current.session.close()
    if (notify) api.sendSignal({ role: 'sharer', channel: 'audio', kind: 'stop' })
  }, [])

  const start = useCallback(async () => {
    if (sender.current || starting) return
    setStarting(true)
    setError('')
    try {
      const source = await api.startSystemAudio()
      if (!source.ok) {
        setError(source.error)
        return
      }
      const deviceId = await findInput(source.label)
      if (!deviceId) {
        api.stopSystemAudio()
        setError('Não achei a fonte de áudio do sistema.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000
        }
      })
      const session = new RtcSession('sharer', api.sendSignal, 'audio')
      session.pc.addTrack(stream.getAudioTracks()[0], stream)
      sender.current = { session, stream }
      setSharing(true)
      await session.offer()
    } catch (err) {
      api.stopSystemAudio()
      setError(`Falha ao capturar áudio: ${(err as Error).message}`)
    } finally {
      setStarting(false)
    }
  }, [starting])

  const closeReceiver = useCallback(() => {
    receiver.current?.close()
    receiver.current = null
    if (audio.current) audio.current.srcObject = null
    setIncoming(false)
  }, [])

  useEffect(() => {
    audio.current = new Audio()
    audio.current.autoplay = true

    const onSignal = async (p: SignalPayload) => {
      if (channelOf(p) !== 'audio') return
      if (p.role === 'viewer') {
        const session = sender.current?.session
        if (!session) return
        if (p.kind === 'answer') await session.setRemote('answer', p.sdp)
        else if (p.kind === 'ice') await session.addIce(p.candidate)
        return
      }
      if (p.kind === 'offer') {
        closeReceiver()
        setMuted(!liveAudioRef.current)
        const session = new RtcSession('viewer', api.sendSignal, 'audio')
        session.pc.ontrack = (e) => {
          if (!audio.current) return
          audio.current.srcObject = e.streams[0] ?? new MediaStream([e.track])
          void audio.current.play().catch(() => undefined)
          setIncoming(true)
        }
        receiver.current = session
        await session.setRemote('offer', p.sdp)
        await session.answer()
      } else if (p.kind === 'ice') {
        await receiver.current?.addIce(p.candidate)
      } else if (p.kind === 'stop') {
        closeReceiver()
      }
    }

    const off = api.onSignal((p) => void onSignal(p).catch((err) => console.warn('[system-audio]', err)))
    return () => {
      off()
      closeReceiver()
    }
  }, [closeReceiver])

  useEffect(() => {
    if (!audio.current) return
    audio.current.volume = volume
    audio.current.muted = muted || ducked
  }, [volume, muted, ducked, incoming])

  useEffect(() => {
    if (connected) return
    stop(false)
    closeReceiver()
  }, [connected, stop, closeReceiver])

  return { sharing, starting, incoming, muted, volume, error, start, stop, setMuted, setVolume }
}
