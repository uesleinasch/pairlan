import { useCallback, useEffect, useRef, useState } from 'react'
import { channelOf, type ChatMessage, type SignalPayload } from '../../shared/protocol'
import { voiceFileName } from './format'
import { RtcSession } from './rtc'

const api = window.pairlan

const MAX_TALK_MS = 120_000
const MIN_MESSAGE_MS = 400

let audioCtx: AudioContext | null = null

function beep(frequency: number, ms = 90): void {
  audioCtx ??= new AudioContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.frequency.value = frequency
  gain.gain.value = 0.08
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + ms / 1000)
}

type Talk = {
  stream: MediaStream
  recorder: MediaRecorder
  chunks: Blob[]
  session: RtcSession | null
  liveOk: boolean
  startedAt: number
  timer: number
}

export type WalkieState = 'idle' | 'connecting' | 'on-air' | 'recording'

export function useWalkie(connected: boolean, liveAudio: boolean, onVoiceMessage: (msgs: ChatMessage[]) => void) {
  const [state, setState] = useState<WalkieState>('idle')
  const [peerLive, setPeerLive] = useState(true)
  const [incoming, setIncoming] = useState(false)
  const [error, setError] = useState('')
  const talk = useRef<Talk | null>(null)
  const pressed = useRef(false)
  const listener = useRef<RtcSession | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const peerLiveRef = useRef(peerLive)
  const liveAudioRef = useRef(liveAudio)
  peerLiveRef.current = peerLive
  liveAudioRef.current = liveAudio

  const stopTalking = useCallback(async () => {
    pressed.current = false
    const t = talk.current
    if (!t) return
    talk.current = null
    window.clearTimeout(t.timer)
    const blob = await new Promise<Blob>((resolve) => {
      t.recorder.onstop = () => resolve(new Blob(t.chunks, { type: 'audio/webm' }))
      t.recorder.stop()
    })
    t.stream.getTracks().forEach((track) => track.stop())
    if (t.session) {
      api.sendSignal({ role: 'sharer', channel: 'voice', kind: 'stop' })
      t.session.close()
    }
    setState('idle')
    if (t.liveOk) {
      beep(520)
      return
    }
    if (Date.now() - t.startedAt < MIN_MESSAGE_MS || blob.size === 0) return
    onVoiceMessage(await api.sendFileData(voiceFileName(), await blob.arrayBuffer()))
  }, [onVoiceMessage])

  const startTalking = useCallback(async () => {
    if (talk.current || pressed.current || !connected) return
    pressed.current = true
    setError('')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
    } catch {
      pressed.current = false
      setError('Microfone indisponível.')
      return
    }
    if (!pressed.current) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.start(250)

    const t: Talk = {
      stream,
      recorder,
      chunks,
      session: null,
      liveOk: false,
      startedAt: Date.now(),
      timer: window.setTimeout(() => void stopTalking(), MAX_TALK_MS)
    }
    talk.current = t

    if (!peerLiveRef.current) {
      setState('recording')
      return
    }
    setState('connecting')
    const session = new RtcSession('sharer', api.sendSignal, 'voice')
    session.pc.addTrack(stream.getAudioTracks()[0], stream)
    session.pc.onconnectionstatechange = () => {
      if (session.pc.connectionState !== 'connected' || talk.current !== t) return
      t.liveOk = true
      setState('on-air')
      beep(880)
    }
    t.session = session
    await session.offer()
  }, [connected, stopTalking])

  const closeListener = useCallback(() => {
    listener.current?.close()
    listener.current = null
    if (audio.current) audio.current.srcObject = null
    setIncoming(false)
  }, [])

  useEffect(() => {
    audio.current = new Audio()
    audio.current.autoplay = true

    const onSignal = async (p: SignalPayload) => {
      if (channelOf(p) !== 'voice') return
      if (p.role === 'viewer') {
        const session = talk.current?.session
        if (!session) return
        if (p.kind === 'answer') await session.setRemote('answer', p.sdp)
        else if (p.kind === 'ice') await session.addIce(p.candidate)
        return
      }
      if (p.kind === 'offer') {
        closeListener()
        if (!liveAudioRef.current) return
        const session = new RtcSession('viewer', api.sendSignal, 'voice')
        session.pc.ontrack = (e) => {
          if (!audio.current) return
          audio.current.srcObject = e.streams[0] ?? new MediaStream([e.track])
          void audio.current.play().catch(() => undefined)
          setIncoming(true)
          beep(660)
        }
        listener.current = session
        await session.setRemote('offer', p.sdp)
        await session.answer()
      } else if (p.kind === 'ice') {
        await listener.current?.addIce(p.candidate)
      } else if (p.kind === 'stop') {
        if (listener.current) beep(440)
        closeListener()
      }
    }

    const offs = [
      api.onSignal((p) => void onSignal(p).catch((err) => console.warn('[walkie]', err))),
      api.onPeerLiveAudio(setPeerLive)
    ]
    return () => {
      offs.forEach((off) => off())
      closeListener()
    }
  }, [closeListener])

  useEffect(() => {
    if (connected) return
    void stopTalking()
    closeListener()
  }, [connected, stopTalking, closeListener])

  return { state, peerLive, incoming, error, startTalking, stopTalking }
}
