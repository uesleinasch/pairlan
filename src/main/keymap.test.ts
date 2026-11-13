import { describe, expect, it } from 'vitest'
import { evdevButton, evdevKey } from './keymap'

describe('evdevKey', () => {
  it('maps KeyboardEvent.code to linux input codes', () => {
    expect(evdevKey('KeyA')).toBe(30)
    expect(evdevKey('KeyM')).toBe(50)
    expect(evdevKey('Digit1')).toBe(2)
    expect(evdevKey('Digit0')).toBe(11)
    expect(evdevKey('F1')).toBe(59)
    expect(evdevKey('F10')).toBe(68)
    expect(evdevKey('F12')).toBe(88)
    expect(evdevKey('Enter')).toBe(28)
    expect(evdevKey('ControlLeft')).toBe(29)
    expect(evdevKey('IntlRo')).toBe(89)
    expect(evdevKey('ArrowDown')).toBe(108)
  })

  it('rejects unknown codes', () => {
    expect(evdevKey('F13')).toBeNull()
    expect(evdevKey('KeyAA')).toBeNull()
    expect(evdevKey('toString')).toBeNull()
  })
})

describe('evdevButton', () => {
  it('maps left, middle and right', () => {
    expect([0, 1, 2, 3].map(evdevButton)).toEqual([0x110, 0x112, 0x111, null])
  })
})
