import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, type WriteStream } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { MAX_ATTACHMENT_BYTES, type Attachment, type ChatMessage } from '../shared/protocol'

export const CHUNK_BYTES = 256 * 1024

export type StoredMessage = ChatMessage & { localPath?: string }

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4'
}

export const guessMime = (name: string): string =>
  MIME_BY_EXT[extname(name).toLowerCase()] ?? 'application/octet-stream'

export function safeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .trim()
  if (!base || /^\.+$/.test(base)) return 'arquivo'
  return (base.startsWith('.') ? `arquivo${base}` : base).slice(0, 180)
}

export function uniquePath(dir: string, name: string): string {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = join(dir, name)
  for (let i = 1; existsSync(candidate); i++) candidate = join(dir, `${stem} (${i})${ext}`)
  return candidate
}

type Incoming = {
  msg: ChatMessage & { attachment: Attachment }
  stream: WriteStream
  tmp: string
  received: number
}

export class FileReceiver {
  private readonly active = new Map<string, Incoming>()

  constructor(private readonly dir: string) {}

  start(msg: ChatMessage & { attachment: Attachment }): void {
    if (this.active.has(msg.id) || msg.attachment.size > MAX_ATTACHMENT_BYTES) return
    mkdirSync(this.dir, { recursive: true })
    const tmp = join(this.dir, `.${msg.id.replace(/[^\w-]/g, '')}.part`)
    this.active.set(msg.id, { msg, tmp, stream: createWriteStream(tmp), received: 0 })
  }

  chunk(id: string, data: string): { received: number; total: number } | null {
    const t = this.active.get(id)
    if (!t) return null
    const buf = Buffer.from(data, 'base64')
    t.received += buf.length
    if (t.received > t.msg.attachment.size) {
      this.abort(id)
      return null
    }
    t.stream.write(buf)
    return { received: t.received, total: t.msg.attachment.size }
  }

  async end(id: string): Promise<StoredMessage | null> {
    const t = this.active.get(id)
    if (!t) return null
    this.active.delete(id)
    await new Promise<void>((resolve) => t.stream.end(() => resolve()))
    if (t.received !== t.msg.attachment.size) {
      rmSync(t.tmp, { force: true })
      return null
    }
    const finalPath = uniquePath(this.dir, safeFileName(t.msg.attachment.name))
    renameSync(t.tmp, finalPath)
    return { ...t.msg, localPath: finalPath }
  }

  abort(id: string): void {
    const t = this.active.get(id)
    if (!t) return
    this.active.delete(id)
    t.stream.once('close', () => rmSync(t.tmp, { force: true }))
    t.stream.destroy()
  }

  abortAll(): void {
    for (const id of [...this.active.keys()]) this.abort(id)
  }
}
