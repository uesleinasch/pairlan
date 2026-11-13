import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isChatMessage, type ChatMessage } from '../shared/protocol'

export class History {
  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true })
  }

  append(msg: ChatMessage): void {
    appendFileSync(this.file, JSON.stringify(msg) + '\n')
  }

  load(limit = 500): ChatMessage[] {
    let raw: string
    try {
      raw = readFileSync(this.file, 'utf8')
    } catch {
      return []
    }
    const out: ChatMessage[] = []
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
