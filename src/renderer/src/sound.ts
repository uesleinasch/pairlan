import { useEffect, useState } from 'react'
import type { SoundOption } from '../../shared/api'

const api = window.pairlan

let context: AudioContext | null = null

export function beep(): void {
  context ??= new AudioContext()
  const now = context.currentTime
  ;[880, 1320].forEach((frequency, i) => {
    const osc = context!.createOscillator()
    const gain = context!.createGain()
    const start = now + i * 0.12
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1)
    osc.connect(gain).connect(context!.destination)
    osc.start(start)
    osc.stop(start + 0.12)
  })
}

export async function playNotifySound(): Promise<void> {
  const url = await api.soundData()
  if (!url) return beep()
  try {
    await new Audio(url).play()
  } catch {
    beep()
  }
}

export function useSoundOptions(customName: string): SoundOption[] {
  const [options, setOptions] = useState<SoundOption[]>([])
  useEffect(() => {
    let alive = true
    void api.listSounds().then((list) => alive && setOptions(list))
    return () => {
      alive = false
    }
  }, [customName])
  return options
}
