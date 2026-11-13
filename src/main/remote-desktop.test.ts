import { describe, expect, it } from 'vitest'
import { dictGet, parseStreams } from './remote-desktop'

const sig = [{ type: 's', child: [] }]

describe('portal results', () => {
  it('reads a{sv} entries', () => {
    expect(dictGet([['session_handle', [sig, ['/s/1']]]], 'session_handle')).toBe('/s/1')
    expect(dictGet([], 'missing')).toBeUndefined()
  })

  it('reads stream ids and sizes from Start', () => {
    const results = [
      ['devices', [sig, [3]]],
      ['streams', [sig, [[[57, [['position', [sig, [[0, 0]]]], ['size', [sig, [[2560, 1440]]]]]]]]]]
    ] as never
    expect(parseStreams(results)).toEqual([{ id: 57, width: 2560, height: 1440 }])
    expect(parseStreams([] as never)).toEqual([])
  })
})
