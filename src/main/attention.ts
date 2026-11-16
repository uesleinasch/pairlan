export const SHAKE_OFFSETS = [14, -14, 11, -11, 8, -8, 5, -5, 2, -2, 0]
export const SHAKE_STEP_MS = 40

export class Throttle {
  private last = -Infinity

  constructor(
    private readonly gapMs: number,
    private readonly now: () => number = Date.now
  ) {}

  take(): boolean {
    const t = this.now()
    if (t - this.last < this.gapMs) return false
    this.last = t
    return true
  }
}

type Shakeable = {
  isDestroyed(): boolean
  isMaximized(): boolean
  isFullScreen(): boolean
  getPosition(): number[]
  setPosition(x: number, y: number): void
}

export function shakeWindow(win: Shakeable, schedule: (fn: () => void, ms: number) => unknown = setTimeout): boolean {
  if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return false
  const [x, y] = win.getPosition()
  SHAKE_OFFSETS.forEach((dx, i) =>
    schedule(() => {
      if (!win.isDestroyed()) win.setPosition(x + dx, y)
    }, i * SHAKE_STEP_MS)
  )
  return true
}
