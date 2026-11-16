import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Topic } from '../shared/topics'
import { exportFileName, TopicStore, topicMarkdown } from './topics'

const setup = (start = 1000) => {
  const file = join(mkdtempSync(join(tmpdir(), 'pairlan-t-')), 'sub/topics.json')
  let now = start
  let seq = 0
  const store = new TopicStore(file, () => now, () => `t${++seq}`)
  return { file, store, tick: (ms: number) => (now += ms) }
}

const remote = (id: string, extra: Partial<Topic> = {}): Topic => ({
  id,
  title: `r ${id}`,
  createdBy: 'b',
  createdAt: 1,
  updatedAt: 1,
  expiresAt: null,
  ...extra
})

describe('TopicStore', () => {
  it('creates topics with a clean title and optional expiry', () => {
    const { file, store } = setup()
    expect(store.create('  ## deploy   sexta ', null, 'a')).toEqual({ id: 't1', title: 'deploy sexta', createdBy: 'a', createdAt: 1000, updatedAt: 1000, expiresAt: null })
    expect(store.create('bug', '1h', 'a')?.expiresAt).toBe(1000 + 3600_000)
    expect(store.create('   ', null, 'a')).toBeNull()
    expect(store.create('x', '2y', 'a')).toBeNull()
    expect(new TopicStore(file).list().map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('renames and changes expiry with a newer updatedAt', () => {
    const { store, tick } = setup()
    store.create('a', null, 'a')
    tick(10)
    expect(store.rename('t1', 'novo')).toMatchObject({ title: 'novo', updatedAt: 1010 })
    expect(store.setExpiry('t1', '1d')).toMatchObject({ expiresAt: 1010 + 86_400_000, updatedAt: 1011 })
    expect(store.setExpiry('t1', null)?.expiresAt).toBeNull()
    expect(store.rename('nope', 'x')).toBeNull()
  })

  it('merges remote topics by last write and keeps deleted ones out', () => {
    const { store } = setup()
    expect(store.upsert(remote('r1', { updatedAt: 5 }))).toBe(true)
    expect(store.upsert(remote('r1', { title: 'velho', updatedAt: 4 }))).toBe(false)
    expect(store.upsert(remote('r1', { title: 'novo', updatedAt: 6 }))).toBe(true)
    expect(store.get('r1')?.title).toBe('novo')
    expect(store.remove('r1')).toBe(true)
    expect(store.upsert(remote('r1', { updatedAt: 99 }))).toBe(false)
    expect(store.deletedIds()).toEqual(['r1'])
  })

  it('syncs deletions and new topics from the peer', () => {
    const { store } = setup()
    store.create('local', null, 'a')
    expect(store.sync([remote('r1')], ['t1'])).toEqual({ changed: true, removed: ['t1'] })
    expect(store.list().map((t) => t.id)).toEqual(['r1'])
    expect(store.sync([remote('r1')], [])).toEqual({ changed: false, removed: [] })
  })

  it('lists expired topics', () => {
    const { store, tick } = setup()
    store.create('a', '1h', 'a')
    store.create('b', null, 'a')
    expect(store.expired()).toEqual([])
    tick(3600_000)
    expect(store.expired()).toEqual(['t1'])
  })

  it('drops corrupt data and old tombstones', () => {
    const { file } = setup()
    const now = 200 * 86_400_000
    const path = file.replace('sub/', '')
    writeFileSync(path, JSON.stringify({ topics: [remote('ok'), remote('ok'), { id: 'x' }], deleted: [{ id: 'old', at: 1 }, { id: 'new', at: now }] }))
    const store = new TopicStore(path, () => now)
    expect(store.list().map((t) => t.id)).toEqual(['ok'])
    expect(store.deletedIds()).toEqual(['new'])
  })
})

describe('export', () => {
  it('writes markdown with messages and attachments', () => {
    const md = topicMarkdown(
      remote('r1', { title: 'deploy', expiresAt: 5000 }),
      [
        { id: '1', from: 'a', fromName: 'Ana', text: '**oi**', ts: 1000 },
        { id: '2', from: 'b', fromName: 'Bia', text: '', ts: 2000, attachment: { name: 'a.png', size: 2048, mime: 'image/png' } }
      ],
      'Bia',
      3000
    )
    expect(md.split('\n')[0]).toBe('# deploy')
    expect(md).toContain('Conversa com Bia')
    expect(md).toContain('apaga em')
    expect(md).toContain('**oi**')
    expect(md).toContain('[anexo] a.png (2 KB)')
    expect(topicMarkdown(null, [], '', 0)).toContain('(sem mensagens)')
  })

  it('builds a safe file name', () => {
    const at = new Date(2026, 10, 16).getTime()
    expect(exportFileName(remote('r', { title: 'Ação / Deploy!' }), at)).toBe('acao-deploy-2026-11-16.md')
    expect(exportFileName(null, at)).toBe('geral-2026-11-16.md')
    expect(exportFileName(remote('r', { title: '!!!' }), at)).toBe('topico-2026-11-16.md')
  })
})
