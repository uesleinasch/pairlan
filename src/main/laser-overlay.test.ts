import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {}, screen: {} }))

const { pickDisplay, toWindowPixel } = await import('./laser-overlay')

const d = (x: number, width: number, height: number, scaleFactor = 1) => ({
  bounds: { x, y: 0, width, height },
  scaleFactor
})

describe('pickDisplay', () => {
  const laptop = d(0, 1280, 800, 1.5)
  const monitor = d(1280, 1920, 1080)

  it('matches the captured size to a monitor', () => {
    expect(pickDisplay([laptop, monitor], laptop, { width: 1920, height: 1080 })).toBe(monitor)
    expect(pickDisplay([laptop, monitor], monitor, { width: 1920, height: 1200 })).toBe(laptop)
  })

  it('falls back to the primary display', () => {
    expect(pickDisplay([laptop, monitor], laptop, { width: 800, height: 600 })).toBe(laptop)
    expect(pickDisplay([laptop, monitor], monitor, null)).toBe(monitor)
  })
})

describe('toWindowPixel', () => {
  it('converts 0..1 to pixels inside the overlay window', () => {
    const display = { x: 1280, y: 0, width: 1920, height: 1080 }
    expect(toWindowPixel(display, display, 0.5, 0.5)).toEqual({ x: 960, y: 540 })
    expect(toWindowPixel(display, { ...display, y: 32 }, 0, 0.5)).toEqual({ x: 0, y: 508 })
  })
})
