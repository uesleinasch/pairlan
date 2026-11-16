import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { importCustomSound, listSystemSounds, MAX_CUSTOM_SOUND_BYTES, resolveSound, soundDataUrl, systemSoundPath } from './sounds'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'pairlan-sound-'))
  dirs.push(dir)
  return dir
}

function themes() {
  const root = tmp()
  const free = join(root, 'free')
  mkdirSync(free)
  writeFileSync(join(free, 'message-new-instant.oga'), 'oga')
  writeFileSync(join(free, 'bell.oga'), 'bell')
  writeFileSync(join(free, 'readme.txt'), 'x')
  return { freedesktop: free, yaru: join(root, 'missing') }
}

describe('system sounds', () => {
  it('lists audio files of existing themes only', () => {
    expect(listSystemSounds(themes())).toEqual([
      { id: 'freedesktop/bell.oga', label: 'Bell · freedesktop' },
      { id: 'freedesktop/message-new-instant.oga', label: 'Message new instant · freedesktop' }
    ])
  })

  it('never leaves the theme folder', () => {
    const t = themes()
    expect(systemSoundPath('freedesktop/bell.oga', t)).toBe(join(t.freedesktop, 'bell.oga'))
    for (const bad of ['freedesktop/../x.oga', 'freedesktop/.hidden.oga', 'outro/bell.oga', 'freedesktop/bell.txt', 'bell.oga']) {
      expect(systemSoundPath(bad, t), bad).toBeNull()
    }
  })

  it('resolves default, beep, system and custom choices', () => {
    const t = themes()
    const dir = tmp()
    expect(resolveSound('', '', dir, t)).toBe(join(t.freedesktop, 'message-new-instant.oga'))
    expect(resolveSound('beep', '', dir, t)).toBeNull()
    expect(resolveSound('freedesktop/bell.oga', '', dir, t)).toBe(join(t.freedesktop, 'bell.oga'))
    expect(resolveSound('freedesktop/sumiu.oga', '', dir, t)).toBeNull()
    expect(resolveSound('custom', 'plim.mp3', dir, t)).toBe(join(dir, 'custom.mp3'))
    expect(resolveSound('', '', dir, { freedesktop: join(dir, 'nada') })).toBeNull()
  })
})

describe('custom sound', () => {
  it('copies the file and replaces the previous one', () => {
    const src = tmp()
    const dir = join(tmp(), 'sounds')
    writeFileSync(join(src, 'Plim.MP3'), 'mp3')
    writeFileSync(join(src, 'toque.wav'), 'wav')
    expect(importCustomSound(join(src, 'Plim.MP3'), dir)).toEqual({ ok: true, name: 'Plim.MP3' })
    expect(importCustomSound(join(src, 'toque.wav'), dir)).toEqual({ ok: true, name: 'toque.wav' })
    expect(readdirSync(dir)).toEqual(['custom.wav'])
    expect(soundDataUrl(join(dir, 'custom.wav'))).toBe(`data:audio/wav;base64,${Buffer.from('wav').toString('base64')}`)
  })

  it('refuses other formats, big files and missing files', () => {
    const src = tmp()
    writeFileSync(join(src, 'x.exe'), 'x')
    writeFileSync(join(src, 'big.mp3'), Buffer.alloc(MAX_CUSTOM_SOUND_BYTES + 1))
    expect(importCustomSound(join(src, 'x.exe'), tmp())).toMatchObject({ ok: false, error: expect.stringMatching(/mp3/) })
    expect(importCustomSound(join(src, 'big.mp3'), tmp())).toMatchObject({ ok: false, error: expect.stringMatching(/2 MB/) })
    expect(importCustomSound(join(src, 'sumiu.mp3'), tmp())).toMatchObject({ ok: false })
    expect(soundDataUrl(join(src, 'sumiu.mp3'))).toBeNull()
    expect(soundDataUrl(null)).toBeNull()
  })
})
