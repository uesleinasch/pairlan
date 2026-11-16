import { useCallback, useEffect, useState } from 'react'
import { strongerAlert, type AlertKind, type OutgoingAlert } from './alerts'

const api = window.pairlan

export function useAlerts(connected: boolean) {
  const [incoming, setIncoming] = useState<AlertKind | null>(null)
  const [shaking, setShaking] = useState(false)
  const [outgoing, setOutgoing] = useState<OutgoingAlert | null>(null)

  useEffect(() => {
    let shakeTimer: number | undefined
    const offs = [
      api.onAlert((level) => setIncoming((prev) => strongerAlert(prev, level))),
      api.onShake(() => {
        setIncoming((prev) => strongerAlert(prev, 'shake'))
        setShaking(true)
        window.clearTimeout(shakeTimer)
        shakeTimer = window.setTimeout(() => setShaking(false), 700)
      }),
      api.onAlertSeen(() => setOutgoing((prev) => prev && { ...prev, seen: true }))
    ]
    return () => {
      window.clearTimeout(shakeTimer)
      offs.forEach((off) => off())
    }
  }, [])

  useEffect(() => {
    if (connected) return
    setIncoming(null)
    setOutgoing(null)
  }, [connected])

  useEffect(() => {
    if (!outgoing?.seen) return
    const timer = window.setTimeout(() => setOutgoing(null), 6000)
    return () => window.clearTimeout(timer)
  }, [outgoing])

  const ack = useCallback(() => {
    setIncoming(null)
    api.ackAlert()
  }, [])

  useEffect(() => {
    if (!incoming) return
    window.addEventListener('pointerdown', ack, true)
    window.addEventListener('keydown', ack, true)
    return () => {
      window.removeEventListener('pointerdown', ack, true)
      window.removeEventListener('keydown', ack, true)
    }
  }, [incoming, ack])

  const send = useCallback((kind: AlertKind) => {
    if (kind === 'shake') api.sendShake()
    else api.sendAlert(kind)
    setOutgoing({ kind, seen: false })
  }, [])

  return { incoming, shaking, outgoing, send, ack }
}
