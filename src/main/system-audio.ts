import { spawn, type ChildProcess } from 'node:child_process'
import type { SystemAudioResult } from '../shared/api'

export function loopbackArgs(nodeName: string, label: string): string[] {
  return [
    `--capture-props=stream.capture.sink=true node.name=${nodeName}_capture node.description="${label} (captura)"`,
    `--playback-props=media.class=Audio/Source node.name=${nodeName} node.description="${label}" priority.session=0 priority.driver=0`
  ]
}

export class SystemAudioSource {
  private child: ChildProcess | null = null
  readonly label: string
  private readonly nodeName: string

  constructor(id: string | number) {
    this.nodeName = `pairlan_system_audio_${id}`
    this.label = `PairLAN - audio do sistema ${id}`
  }

  start(): Promise<SystemAudioResult> {
    if (this.child) return Promise.resolve({ ok: true, label: this.label })
    return new Promise((resolve) => {
      const child = spawn('pw-loopback', loopbackArgs(this.nodeName, this.label), { stdio: 'ignore' })
      let settled = false
      const settle = (r: SystemAudioResult) => {
        if (settled) return
        settled = true
        resolve(r)
      }
      child.once('error', (err: NodeJS.ErrnoException) => {
        this.child = null
        settle({
          ok: false,
          error: err.code === 'ENOENT' ? 'pw-loopback não encontrado (instale o pacote pipewire-bin).' : err.message
        })
      })
      child.once('exit', (code) => {
        if (this.child === child) this.child = null
        settle({ ok: false, error: `pw-loopback saiu com código ${code}` })
      })
      child.once('spawn', () => {
        this.child = child
        setTimeout(() => settle({ ok: true, label: this.label }), 300)
      })
    })
  }

  stop(): void {
    this.child?.kill()
    this.child = null
  }
}
