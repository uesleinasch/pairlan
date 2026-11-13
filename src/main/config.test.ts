import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clampOpacity, ConfigStore, LINK_PORT, runtimeOptions } from './config'

describe('clampOpacity', () => {
  it('keeps values between 0.3 and 1', () => {
    expect(clampOpacity(0.1)).toBe(0.3)
    expect(clampOpacity(2)).toBe(1)
    expect(clampOpacity(0.654)).toBe(0.65)
    expect(clampOpacity('x')).toBe(1)
    expect(clampOpacity(Number.NaN)).toBe(1)
  })
})

describe('runtimeOptions', () => {
  it('reads profile and port offset', () => {
    expect(runtimeOptions({})).toEqual({ profile: null, linkPort: LINK_PORT })
    expect(runtimeOptions({ PAIRLAN_PROFILE: 'b/../x', PAIRLAN_PORT_OFFSET: '1' })).toEqual({
      profile: 'bx',
      linkPort: LINK_PORT + 1
    })
  })
})

describe('ConfigStore', () => {
  it('creates a stable id and persists updates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pairlan-cfg-'))
    const first = new ConfigStore(dir)
    const id = first.get().id
    first.update({ name: '  Ana  ', opacity: 0.05, id: 'hijack' })

    const second = new ConfigStore(dir).get()
    expect(second.id).toBe(id)
    expect(second.name).toBe('Ana')
    expect(second.opacity).toBe(0.3)
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).id).toBe(id)
  })
})
