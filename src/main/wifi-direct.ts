import { execFile, execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import type { WifiDirectStatus } from '../shared/api'

export const P2P_CONNECTION = 'pairlan-p2p'
const SUBNET = '10.42.99'
const ATTEMPTS = 6
const UP_TIMEOUT_S = 40
const RETRY_PAUSE_MS = 2000
const WATCH_MS = 5000

export type Exec = (cmd: string, args: string[]) => Promise<string>

const exec: Exec = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: (UP_TIMEOUT_S + 10) * 1000 }, (err, stdout, stderr) =>
      err ? reject(new Error(String(stderr).trim() || err.message)) : resolve(String(stdout))
    )
  )

export function parseP2pDevice(iwDev: string): string | null {
  let addr: string | null = null
  for (const line of iwDev.split('\n')) {
    const [key, value] = line.trim().split(/\s+/)
    if (key === 'addr') addr = value?.toLowerCase() ?? null
    if (key === 'type' && value === 'P2P-device') return addr
  }
  return null
}

export function p2pAddresses(self: string, peer: string): { mine: string; other: string; dials: boolean } {
  const low = self < peer
  return { mine: `${SUBNET}.${low ? 1 : 2}`, other: `${SUBNET}.${low ? 2 : 1}`, dials: !low }
}

type Events = { status: [WifiDirectStatus]; dropped: [string] }

export class WifiDirect extends EventEmitter<Events> {
  private value: WifiDirectStatus = { state: 'unsupported', self: null, peer: null, ip: null, error: null }
  private generation = 0
  private watcher: NodeJS.Timeout | null = null

  constructor(
    private readonly run: Exec = exec,
    private readonly pauseMs = RETRY_PAUSE_MS
  ) {
    super()
  }

  async init(): Promise<void> {
    const self = await this.run('iw', ['dev']).then(parseP2pDevice, () => null)
    await this.removeConnection()
    this.set(self ? { state: 'off', self } : { state: 'unsupported', self: null })
  }

  status(): WifiDirectStatus {
    return { ...this.value }
  }

  isActive(): boolean {
    return this.value.state === 'on' || this.value.state === 'connecting'
  }

  knowPeer(peer: string): void {
    if (!this.isActive() && this.value.peer !== peer) this.set({ peer })
  }

  async start(peer: string): Promise<boolean> {
    const self = this.value.self
    if (!self || peer === self) return false
    const gen = ++this.generation
    this.stopWatch()
    const { mine } = p2pAddresses(self, peer)
    this.set({ state: 'connecting', peer, ip: null, error: null })
    try {
      await this.removeConnection()
      await this.run('nmcli', [
        'connection', 'add', 'type', 'wifi-p2p', 'con-name', P2P_CONNECTION, 'wifi-p2p.peer', peer,
        'connection.autoconnect', 'no', 'ipv4.method', 'manual', 'ipv4.addresses', `${mine}/24`, 'ipv6.method', 'disabled'
      ])
      for (let i = 0; i < ATTEMPTS && gen === this.generation; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, this.pauseMs))
        if (gen !== this.generation) break
        const up = await this.run('nmcli', ['--wait', String(UP_TIMEOUT_S), 'connection', 'up', P2P_CONNECTION]).then(
          () => true,
          () => false
        )
        if (up && gen === this.generation) {
          this.set({ state: 'on', ip: mine })
          this.watch(gen)
          return true
        }
      }
      if (gen === this.generation) this.set({ state: 'error', error: 'O par não respondeu. Liguem o Wi-Fi Direct nos dois PCs ao mesmo tempo.' })
    } catch (err) {
      if (gen === this.generation) this.set({ state: 'error', error: err instanceof Error ? err.message : 'Falha no Wi-Fi Direct.' })
    }
    return false
  }

  async stop(): Promise<void> {
    this.generation++
    this.stopWatch()
    if (this.value.self) this.set({ state: 'off', ip: null, error: null })
    await this.removeConnection()
  }

  shutdown(): void {
    this.generation++
    this.stopWatch()
    try {
      execFileSync('nmcli', ['connection', 'delete', P2P_CONNECTION], { timeout: 3000, stdio: 'ignore' })
    } catch {
      return
    }
  }

  private watch(gen: number): void {
    this.watcher = setInterval(() => {
      void this.run('nmcli', ['-g', 'GENERAL.STATE', 'connection', 'show', P2P_CONNECTION])
        .then((out) => out.trim() === 'activated', () => false)
        .then((alive) => {
          if (alive || gen !== this.generation) return
          this.generation++
          this.stopWatch()
          const peer = this.value.peer ?? ''
          this.set({ state: 'error', ip: null, error: 'O Wi-Fi Direct caiu.' })
          this.emit('dropped', peer)
        })
    }, WATCH_MS)
  }

  private stopWatch(): void {
    if (this.watcher) clearInterval(this.watcher)
    this.watcher = null
  }

  private async removeConnection(): Promise<void> {
    await this.run('nmcli', ['connection', 'down', P2P_CONNECTION]).catch(() => '')
    await this.run('nmcli', ['connection', 'delete', P2P_CONNECTION]).catch(() => '')
  }

  private set(patch: Partial<WifiDirectStatus>): void {
    this.value = { ...this.value, ...patch }
    this.emit('status', this.status())
  }
}
