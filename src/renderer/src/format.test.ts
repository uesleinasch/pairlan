import { describe, expect, it } from 'vitest'
import { formatBytes, pastedFileName, voiceFileName } from './format'

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
  })
})

describe('pastedFileName', () => {
  it('builds a timestamped name from mime', () => {
    const d = new Date(2026, 10, 13, 9, 5, 7)
    expect(pastedFileName('image/png', d)).toBe('colado-20261113-090507.png')
    expect(pastedFileName('image/jpeg', d)).toBe('colado-20261113-090507.jpg')
    expect(pastedFileName('', d)).toBe('colado-20261113-090507.bin')
    expect(voiceFileName(d)).toBe('voz-20261113-090507.webm')
  })
})
