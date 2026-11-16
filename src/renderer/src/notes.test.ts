import { describe, expect, it } from 'vitest'
import type { Note } from '../../shared/notes'
import { filterNotes, hitCounts, matchRanges, noteDate, parseHitArg, preview, shortDate, sortNotes, splitMatches } from './notes'

const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id,
  messageId: `m${id}`,
  from: 'a',
  fromName: 'Ana',
  text: `texto ${id}`,
  ts: 1,
  savedAt: Number(id),
  hit: null,
  comment: '',
  ...extra
})

describe('notes helpers', () => {
  it('matches ignoring case and accents', () => {
    expect(matchRanges('Ação no BUILD e build', 'build')).toEqual([
      [8, 13],
      [16, 21]
    ])
    expect(matchRanges('Ação', 'acao')).toEqual([[0, 4]])
    expect(matchRanges('abc', '  ')).toEqual([])
  })

  it('splits text around matches', () => {
    expect(splitMatches('npm run build:prod', 'build')).toEqual([
      { text: 'npm run ', hit: false },
      { text: 'build', hit: true },
      { text: ':prod', hit: false }
    ])
    expect(splitMatches('', 'x')).toEqual([{ text: '', hit: false }])
  })

  it('sorts hits by level then newest', () => {
    const list = [note('1'), note('2', { hit: 'green' }), note('3', { hit: 'red' }), note('4'), note('5', { hit: 'red' })]
    expect(sortNotes(list).map((n) => n.id)).toEqual(['5', '3', '2', '4', '1'])
  })

  it('filters by level and by text, name, comment or attachment', () => {
    const list = [
      note('1', { text: 'deploy', hit: 'yellow' }),
      note('2', { comment: 'rever deploy' }),
      note('3', { fromName: 'Deploybot' }),
      note('4', { text: '', attachment: { name: 'deploy.log', size: 1, mime: 'text/plain' } }),
      note('5')
    ]
    expect(filterNotes(list, 'deploy', 'all').map((n) => n.id)).toEqual(['1', '4', '3', '2'])
    expect(filterNotes(list, '', 'yellow').map((n) => n.id)).toEqual(['1'])
    expect(hitCounts(list)).toEqual({ red: 0, yellow: 1, green: 0 })
  })

  it('parses hit words', () => {
    expect(parseHitArg('')).toBeNull()
    expect(parseHitArg('Vermelho')).toBe('red')
    expect(parseHitArg('amarelo')).toBe('yellow')
    expect(parseHitArg('verde')).toBe('green')
    expect(parseHitArg('azul')).toBeUndefined()
  })

  it('formats date and preview', () => {
    const ts = new Date(2026, 10, 13, 14, 4).getTime()
    expect(noteDate(ts, ts)).toBe('13 nov · 14:04')
    expect(shortDate(new Date(2026, 0, 5, 9, 7).getTime())).toBe('05/01 09:07')
    expect(noteDate(ts, new Date(2027, 0, 1).getTime())).toBe('13 nov 2026 · 14:04')
    expect(preview('a\n  b', 10)).toBe('a b')
    expect(preview('abcdefghij', 5)).toBe('abcd…')
  })
})
