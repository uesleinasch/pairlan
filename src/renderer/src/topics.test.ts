import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../shared/protocol'
import { expiresIn, type Topic } from '../../shared/topics'
import { GENERAL, knownIds, lastByKey, messagesIn, resolveTopic, sortByActivity, splitDuration, unreadByKey } from './topics'

const topic = (id: string, title: string, createdAt = 0): Topic => ({ id, title, createdBy: 'a', createdAt, updatedAt: createdAt, expiresAt: null })
const msg = (id: string, ts: number, from = 'b', t?: string): ChatMessage => ({ id, from, fromName: from, text: id, ts, ...(t ? { topic: t } : {}) })

const topics = [topic('t1', 'deploy sexta', 1), topic('t2', 'bug login', 2)]
const known = knownIds(topics)
const messages = [msg('1', 10), msg('2', 20, 'b', 't1'), msg('3', 30, 'a', 't1'), msg('4', 40, 'b', 'gone'), msg('5', 50, 'b', 't2')]

describe('topic helpers', () => {
  it('splits messages by conversation, unknown topics fall back to Geral', () => {
    expect(messagesIn(messages, GENERAL, known).map((m) => m.id)).toEqual(['1', '4'])
    expect(messagesIn(messages, 't1', known).map((m) => m.id)).toEqual(['2', '3'])
    expect(lastByKey(messages, known).get('t1')?.id).toBe('3')
  })

  it('counts unread from the peer after the last seen time', () => {
    const counts = unreadByKey(messages, { t1: 15 }, 35, 'a', known)
    expect(Object.fromEntries(counts)).toEqual({ t1: 1, '': 1, t2: 1 })
  })

  it('sorts topics by last activity', () => {
    expect(sortByActivity(topics, lastByKey(messages, known)).map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('resolves topics by number or name', () => {
    expect(resolveTopic('0', topics)).toBeNull()
    expect(resolveTopic('geral', topics)).toBeNull()
    expect(resolveTopic('2', topics)).toBe('t2')
    expect(resolveTopic('9', topics)).toBeUndefined()
    expect(resolveTopic('#Deploy Sexta', topics)).toBe('t1')
    expect(resolveTopic('bug', topics)).toBe('t2')
    expect(resolveTopic('x', topics)).toBeUndefined()
  })

  it('reads an optional duration at the end', () => {
    expect(splitDuration('hotfix pix 1d')).toEqual({ title: 'hotfix pix', duration: '1d' })
    expect(splitDuration('hotfix pix')).toEqual({ title: 'hotfix pix', duration: null })
    expect(splitDuration('30D')).toEqual({ title: '', duration: '30d' })
  })

  it('describes time left', () => {
    const h = 3600_000
    expect(expiresIn(0, 10)).toBe('agora')
    expect(expiresIn(30 * 60_000, 0)).toBe('30 min')
    expect(expiresIn(h, 0)).toBe('1 hora')
    expect(expiresIn(5 * h, 0)).toBe('5 horas')
    expect(expiresIn(48 * h, 0)).toBe('2 dias')
  })
})
