import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { History } from './history'

const msg = (id: string) => ({ id, from: 'a', fromName: 'Ana', text: `m${id}`, ts: Number(id) })

describe('History', () => {
  it('returns empty when file does not exist', () => {
    expect(new History(join(mkdtempSync(join(tmpdir(), 'pairlan-h-')), 'x/history.jsonl')).load()).toEqual([])
  })

  it('appends, skips corrupt lines and keeps the latest entries', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pairlan-h-')), 'history.jsonl')
    const h = new History(file)
    h.append(msg('1'))
    appendFileSync(file, '{broken\n{"id":"x"}\n')
    h.append(msg('2'))
    h.append(msg('3'))
    expect(h.load().map((m) => m.id)).toEqual(['1', '2', '3'])
    expect(h.load(2).map((m) => m.id)).toEqual(['2', '3'])
  })
})
