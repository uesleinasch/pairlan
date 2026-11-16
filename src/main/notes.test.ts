import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NoteStore } from './notes'

const msg = (id: string, extra: object = {}) => ({ id, from: 'a', fromName: 'Ana', text: `m${id}`, ts: 100, ...extra })

const setup = () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pairlan-n-')), 'sub/notes.json')
  let seq = 0
  const store = new NoteStore(file, () => 500, () => `n${++seq}`)
  return { file, store }
}

describe('NoteStore', () => {
  it('starts empty without a file', () => {
    expect(setup().store.list()).toEqual([])
  })

  it('saves a message once and persists a copy', () => {
    const { file, store } = setup()
    store.save(msg('1', { attachment: { name: 'a.png', size: 3, mime: 'image/png' } }))
    store.save(msg('1'))
    const notes = new NoteStore(file).list()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ id: 'n1', messageId: '1', text: 'm1', savedAt: 500, hit: null, comment: '', attachment: { name: 'a.png' } })
  })

  it('saving again with a hit updates the level', () => {
    const { store } = setup()
    store.save(msg('1'))
    expect(store.save(msg('1'), 'red')[0].hit).toBe('red')
    expect(store.save(msg('1'))[0].hit).toBe('red')
  })

  it('rejects bad input', () => {
    const { store } = setup()
    expect(store.save({ id: 1 })).toEqual([])
    expect(store.save(msg('1'), 'blue')).toEqual([])
    store.save(msg('1'))
    expect(store.setHit('n1', 'purple')[0].hit).toBeNull()
    expect(store.setComment('n1', 42)[0].comment).toBe('')
    expect(store.setHit('missing', 'red')[0].hit).toBeNull()
  })

  it('sets hit, comment and removes', () => {
    const { store } = setup()
    store.save(msg('1'))
    store.save(msg('2'))
    expect(store.setHit('n2', 'green')[1].hit).toBe('green')
    expect(store.setHit('n2', null)[1].hit).toBeNull()
    expect(store.setComment('n1', '  rever  ')[0].comment).toBe('rever')
    expect(store.setComment('n1', 'x'.repeat(2000))[0].comment).toHaveLength(1000)
    expect(store.remove('n1').map((n) => n.id)).toEqual(['n2'])
  })

  it('restores a removed note but not a duplicate', () => {
    const { store } = setup()
    const [note] = store.save(msg('1'))
    store.remove(note.id)
    expect(store.restore(note)).toEqual([note])
    expect(store.restore(note)).toHaveLength(1)
    expect(store.restore({ ...note, id: 'other' })).toHaveLength(1)
  })

  it('skips corrupt entries and duplicates', () => {
    const { file, store } = setup()
    store.save(msg('1'))
    const good = JSON.parse(readFileSync(file, 'utf8'))[0]
    writeFileSync(file, JSON.stringify([good, good, { id: 'x' }, null]))
    expect(new NoteStore(file).list()).toEqual([good])
    writeFileSync(file, '{broken')
    expect(new NoteStore(file).list()).toEqual([])
  })
})
