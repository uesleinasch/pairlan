import { describe, expect, it } from 'vitest'
import { videoPoint } from './pointer'

describe('videoPoint', () => {
  const rect = { left: 10, top: 20, width: 400, height: 300 }

  it('maps a letterboxed 16:9 video to 0..1', () => {
    expect(videoPoint(rect, 1600, 900, 10, 20 + 37.5)).toEqual({ x: 0, y: 0 })
    expect(videoPoint(rect, 1600, 900, 210, 170)).toEqual({ x: 0.5, y: 0.5 })
    expect(videoPoint(rect, 1600, 900, 410, 20 + 262.5)).toEqual({ x: 1, y: 1 })
  })

  it('ignores the black bars and missing sizes', () => {
    expect(videoPoint(rect, 1600, 900, 210, 25)).toBeNull()
    expect(videoPoint(rect, 0, 0, 210, 170)).toBeNull()
  })
})
