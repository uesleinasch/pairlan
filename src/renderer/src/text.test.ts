import { describe, expect, it } from 'vitest'
import { splitFences } from './text'

describe('splitFences', () => {
  it('keeps plain text as one part', () => {
    expect(splitFences('oi, tudo bem?')).toEqual([{ kind: 'text', value: 'oi, tudo bem?' }])
  })

  it('extracts fenced blocks with or without language', () => {
    expect(splitFences('olha:\n```ts\nconst a = 1\n```\ne isso\n```\nx\n```')).toEqual([
      { kind: 'text', value: 'olha:\n' },
      { kind: 'code', value: 'const a = 1' },
      { kind: 'text', value: '\ne isso\n' },
      { kind: 'code', value: 'x' }
    ])
  })

  it('leaves an unclosed fence as text', () => {
    expect(splitFences('```ts\nconst a')).toEqual([{ kind: 'text', value: '```ts\nconst a' }])
  })
})
