import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { hostname, userInfo } from 'node:os'
import { join } from 'node:path'
import type { AppConfig } from '../shared/api'

export const DISCOVERY_PORT = 47800
export const LINK_PORT = 47801
export const MIN_OPACITY = 0.3

export function clampOpacity(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 1
  return Math.round(Math.min(1, Math.max(MIN_OPACITY, n)) * 100) / 100
}

export type RuntimeOptions = { profile: string | null; linkPort: number }

export function runtimeOptions(env: NodeJS.ProcessEnv): RuntimeOptions {
  const profile = env.PAIRLAN_PROFILE?.trim().replace(/[^\w-]/g, '') || null
  const offset = Number.parseInt(env.PAIRLAN_PORT_OFFSET ?? '0', 10)
  return { profile, linkPort: LINK_PORT + (Number.isFinite(offset) ? offset : 0) }
}

function defaultName(): string {
  try {
    return userInfo().username
  } catch {
    return hostname()
  }
}

export function shellPrompt(user = defaultName(), host = hostname()): string {
  return `${user}@${host.split('.')[0]}`
}

export type WindowLook = { title: string; icon: string }

export const windowLook = (terminalMode: boolean, prompt: string): WindowLook =>
  terminalMode ? { title: `${prompt}: ~/pair`, icon: 'terminal.png' } : { title: 'Notes', icon: 'icon.png' }

export function normalizeConfig(raw: Partial<AppConfig>): AppConfig {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : defaultName(),
    opacity: clampOpacity(raw.opacity),
    alwaysOnTop: raw.alwaysOnTop === true,
    notifyMinimized: raw.notifyMinimized !== false,
    manualPeer: typeof raw.manualPeer === 'string' ? raw.manualPeer.trim() : '',
    liveAudio: raw.liveAudio !== false,
    terminalMode: raw.terminalMode === true
  }
}

export class ConfigStore {
  private readonly file: string
  private value: AppConfig

  constructor(dir: string) {
    this.file = join(dir, 'config.json')
    let raw: Partial<AppConfig> = {}
    try {
      raw = JSON.parse(readFileSync(this.file, 'utf8'))
    } catch {
      raw = {}
    }
    this.value = normalizeConfig(raw)
    mkdirSync(dir, { recursive: true })
    this.persist()
  }

  get(): AppConfig {
    return { ...this.value }
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.value = normalizeConfig({ ...this.value, ...patch, id: this.value.id })
    this.persist()
    return this.get()
  }

  private persist(): void {
    writeFileSync(this.file, JSON.stringify(this.value, null, 2))
  }
}
