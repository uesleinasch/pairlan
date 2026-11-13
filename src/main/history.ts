import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isChatMessage } from '../shared/protocol'
import type { StoredMessage } from './transfer'

export class History {
  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true })
  }

  append(msg: StoredMessage): void {
    appendFileSync(this.file, JSON.stringify(msg) + '\n')
  }

  clear(): void {
    writeFileSync(this.file, '')
  }

  load(limit = 500): StoredMessage[] {
    let raw: string
    try {
      raw = readFileSync(this.file, 'utf8')
    } catch {
      return []
    }
    const out: StoredMessage[] = []
    for (const line of raw.split('\n')) {
      if (!line) continue
      try {
        const msg = JSON.parse(line)
        if (isChatMessage(msg)) out.push(msg)
      } catch {
        continue
      }
    }
    return out.slice(-limit)
  }
}
