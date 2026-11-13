import { describe, expect, it } from 'vitest'
import { RemoteControl, type InputSink } from './remote-control'

const sink = (active = true) => {
  const calls: string[] = []
  const s: InputSink = {
    isActive: () => active,
    move: (x, y) => calls.push(`move ${x} ${y}`),
    button: (c, d) => calls.push(`button ${c} ${d}`),
    scroll: (dx, dy) => calls.push(`scroll ${dx} ${dy}`),
    key: (c, d) => calls.push(`key ${c} ${d}`)
  }
  return { s, calls }
}

describe('RemoteControl', () => {
  it('maps input to evdev codes', () => {
    const { s, calls } = sink()
    const rc = new RemoteControl(s)
    rc.apply({ kind: 'move', x: 0.5, y: 0.25 })
    rc.apply({ kind: 'button', button: 0, down: true })
    rc.apply({ kind: 'key', code: 'KeyA', down: true })
    rc.apply({ kind: 'key', code: 'Nope', down: true })
    rc.apply({ kind: 'scroll', dx: 0, dy: 2 })
    expect(calls).toEqual(['move 0.5 0.25', 'button 272 true', 'key 30 true', 'scroll 0 2'])
  })

  it('releases held keys and buttons, and ignores stray key-ups', () => {
    const { s, calls } = sink()
    const rc = new RemoteControl(s)
    rc.apply({ kind: 'key', code: 'ShiftLeft', down: false })
    rc.apply({ kind: 'key', code: 'ShiftLeft', down: true })
    rc.apply({ kind: 'button', button: 2, down: true })
    calls.length = 0
    rc.releaseAll()
    expect(calls).toEqual(['key 42 false', 'button 273 false'])
    rc.releaseAll()
    expect(calls).toHaveLength(2)
  })

  it('does nothing while the portal session is off', () => {
    const { s, calls } = sink(false)
    new RemoteControl(s).apply({ kind: 'move', x: 0, y: 0 })
    expect(calls).toEqual([])
  })
})
