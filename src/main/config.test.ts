import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clampOpacity, ConfigStore, LINK_PORT, normalizeConfig, runtimeOptions, windowLook } from './config'

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
    expect(second.liveAudio).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).id).toBe(id)
  })
})

describe('normalizeConfig', () => {
  it('turns minimized notifications on by default, even for old configs', () => {
    expect(normalizeConfig({}).notifyMinimized).toBe(true)
    expect(normalizeConfig({ notifications: false } as never).notifyMinimized).toBe(true)
    expect(normalizeConfig({ notifyMinimized: false }).notifyMinimized).toBe(false)
  })
})

describe('terminal mode', () => {
  it('is off by default', () => {
    expect(normalizeConfig({}).terminalMode).toBe(false)
    expect(normalizeConfig({ terminalMode: true }).terminalMode).toBe(true)
  })

  it('uses the fake folder as the window title', () => {
    expect(windowLook({ terminalMode: true, terminalPath: '~/Code/api' })).toEqual({ title: '~/Code/api', icon: 'terminal.png' })
    expect(windowLook({ terminalMode: false, terminalPath: '~/Code/api' })).toEqual({ title: 'Notes', icon: 'icon.png' })
  })

  it('cleans the fake folder and branch', () => {
    expect(normalizeConfig({}).terminalPath).toBe('~/Code/api')
    expect(normalizeConfig({}).terminalBranch).toBe('main')
    expect(normalizeConfig({ terminalPath: '  ~/x/y  ', terminalBranch: 'feat/\nbug' }).terminalPath).toBe('~/x/y')
    expect(normalizeConfig({ terminalBranch: 'feat/\nbug' }).terminalBranch).toBe('feat/ bug')
    expect(normalizeConfig({ terminalPath: 42 as never }).terminalPath).toBe('~/Code/api')
  })
})
