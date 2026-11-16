import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { SoundOption } from '../shared/api'

export const SOUND_THEMES: Record<string, string> = {
  freedesktop: '/usr/share/sounds/freedesktop/stereo',
  yaru: '/usr/share/sounds/Yaru/stereo',
  gnome: '/usr/share/sounds/gnome/default/alerts'
}

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav'
}

export const CUSTOM_SOUND_EXTS = Object.keys(MIME).map((ext) => ext.slice(1))
export const MAX_CUSTOM_SOUND_BYTES = 2 * 1024 * 1024
const DEFAULT_SYSTEM_SOUNDS = ['freedesktop/message-new-instant.oga', 'yaru/message-new-instant.oga', 'gnome/swing.ogg']
const SYSTEM_ID = /^([a-z]+)\/([a-z0-9][\w.-]*)$/

const soundExt = (name: string) => {
  const ext = extname(name).toLowerCase()
  return ext in MIME ? ext : null
}

export const isCustomSoundName = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && soundExt(value) !== null && basename(value) === value

export function systemSoundPath(id: string, themes = SOUND_THEMES): string | null {
  const match = SYSTEM_ID.exec(id)
  if (!match || !soundExt(match[2])) return null
  const dir = themes[match[1]]
  return dir ? join(dir, match[2]) : null
}

export const isSoundChoice = (value: unknown): value is string =>
  typeof value === 'string' && (value === '' || value === 'beep' || value === 'custom' || systemSoundPath(value) !== null)

const labelOf = (file: string) => {
  const words = file.slice(0, -extname(file).length).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function listSystemSounds(themes = SOUND_THEMES): SoundOption[] {
  return Object.entries(themes).flatMap(([theme, dir]) => {
    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      return []
    }
    return files
      .filter((file) => soundExt(file) && SYSTEM_ID.test(`${theme}/${file}`))
      .sort()
      .map((file) => ({ id: `${theme}/${file}`, label: `${labelOf(file)} · ${theme}` }))
  })
}

export const customSoundPath = (dir: string, name: string) => join(dir, `custom${soundExt(name) ?? ''}`)

export function resolveSound(choice: string, customName: string, dir: string, themes = SOUND_THEMES): string | null {
  if (choice === 'beep') return null
  if (choice === 'custom') return isCustomSoundName(customName) ? customSoundPath(dir, customName) : null
  const candidates = choice ? [choice] : DEFAULT_SYSTEM_SOUNDS
  for (const id of candidates) {
    const path = systemSoundPath(id, themes)
    if (path && existsSync(path)) return path
  }
  return null
}

export function soundDataUrl(path: string | null): string | null {
  const ext = path && soundExt(path)
  if (!path || !ext) return null
  try {
    if (statSync(path).size > MAX_CUSTOM_SOUND_BYTES) return null
    return `data:${MIME[ext]};base64,${readFileSync(path).toString('base64')}`
  } catch {
    return null
  }
}

export type ImportResult = { ok: true; name: string } | { ok: false; error: string }

export function importCustomSound(source: string, dir: string): ImportResult {
  const name = basename(source).slice(-120)
  if (!soundExt(name)) return { ok: false, error: 'Use um arquivo mp3, ogg ou wav.' }
  let size: number
  try {
    size = statSync(source).size
  } catch {
    return { ok: false, error: 'Não deu para ler o arquivo.' }
  }
  if (size > MAX_CUSTOM_SOUND_BYTES) return { ok: false, error: 'O som precisa ter até 2 MB.' }
  try {
    mkdirSync(dir, { recursive: true })
    for (const file of readdirSync(dir)) {
      if (file.startsWith('custom.')) rmSync(join(dir, file), { force: true })
    }
    copyFileSync(source, customSoundPath(dir, name))
  } catch {
    return { ok: false, error: 'Não deu para salvar o som.' }
  }
  return { ok: true, name }
}
