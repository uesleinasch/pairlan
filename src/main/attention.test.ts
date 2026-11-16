import { describe, expect, it } from 'vitest'
import { SHAKE_OFFSETS, shakeWindow, Throttle } from './attention'

describe('Throttle', () => {
  it('lets one call through per gap', () => {
    let now = 0
    const gate = new Throttle(2000, () => now)
    expect(gate.take()).toBe(true)
    now = 1999
    expect(gate.take()).toBe(false)
    now = 2000
    expect(gate.take()).toBe(true)
  })
})

describe('shakeWindow', () => {
  const fakeWindow = (over: Partial<Record<'max' | 'full' | 'gone', boolean>> = {}) => {
    const moves: number[][] = []
    return {
      moves,
      isDestroyed: () => over.gone === true,
      isMaximized: () => over.max === true,
      isFullScreen: () => over.full === true,
      getPosition: () => [100, 50],
      setPosition: (x: number, y: number) => moves.push([x, y])
    }
  }

  it('moves side to side and ends where it started', () => {
    const win = fakeWindow()
    expect(shakeWindow(win, (fn) => fn())).toBe(true)
    expect(win.moves).toHaveLength(SHAKE_OFFSETS.length)
    expect(win.moves.every(([, y]) => y === 50)).toBe(true)
    expect(win.moves.at(-1)).toEqual([100, 50])
  })

  it('leaves maximized and fullscreen windows alone', () => {
    for (const over of [{ max: true }, { full: true }, { gone: true }]) {
      const win = fakeWindow(over)
      expect(shakeWindow(win, (fn) => fn())).toBe(false)
      expect(win.moves).toEqual([])
    }
  })
})
