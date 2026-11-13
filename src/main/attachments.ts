import { randomUUID } from 'node:crypto'
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { TransferProgress } from '../shared/api'
import { MAX_ATTACHMENT_BYTES, type Attachment, type ChatMessage, type PeerInfo, type WireMessage } from '../shared/protocol'
import type { History } from './history'
import type { PeerLink } from './peer-link'
import { CHUNK_BYTES, FileReceiver, guessMime, safeFileName, uniquePath, type StoredMessage } from './transfer'

const MAX_PREVIEW_BYTES = 15 * 1024 * 1024

type Options = {
  link: PeerLink
  history: History
  dir: string
  self: () => PeerInfo
  onMessage: (msg: StoredMessage) => void
  onProgress: (p: TransferProgress) => void
}

export class AttachmentService {
  private readonly receiver: FileReceiver
  private readonly paths = new Map<string, { path: string; attachment: Attachment }>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly opts: Options) {
    this.receiver = new FileReceiver(opts.dir)
    for (const m of opts.history.load(Number.MAX_SAFE_INTEGER)) this.remember(m)
  }

  sendPaths(paths: string[]): Promise<StoredMessage[]> {
    const run = this.queue.then(async () => {
      const sent: StoredMessage[] = []
      for (const path of paths) {
        const msg = await this.sendPath(path)
        if (msg) sent.push(msg)
      }
      return sent
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  sendData(name: string, data: ArrayBuffer): Promise<StoredMessage[]> {
    mkdirSync(this.opts.dir, { recursive: true })
    const path = uniquePath(this.opts.dir, safeFileName(name))
    writeFileSync(path, Buffer.from(data))
    return this.sendPaths([path])
  }

  handleWire(m: WireMessage): boolean {
    switch (m.t) {
      case 'file-start':
        this.receiver.start(m.msg)
        this.progress(m.msg.id, m.msg.attachment.name, 'in', 0, m.msg.attachment.size)
        return true
      case 'file-chunk': {
        const p = this.receiver.chunk(m.id, m.data)
        if (p) this.progressById(m.id, 'in', p.received, p.total)
        return true
      }
      case 'file-end':
        void this.receiver.end(m.id).then((msg) => {
          this.done(m.id)
          if (!msg) return
          this.opts.history.append(msg)
          this.remember(msg)
          this.opts.onMessage(msg)
        })
        return true
      default:
        return false
    }
  }

  abortIncoming(): void {
    this.receiver.abortAll()
  }

  pathFor(id: string): string | null {
    return this.paths.get(id)?.path ?? null
  }

  async preview(id: string): Promise<string | null> {
    const entry = this.paths.get(id)
    const previewable = /^(image|audio)\//.test(entry?.attachment.mime ?? '')
    if (!entry || !previewable || entry.attachment.size > MAX_PREVIEW_BYTES) return null
    try {
      const data = await readFile(entry.path)
      return `data:${entry.attachment.mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  }

  private async sendPath(path: string): Promise<StoredMessage | null> {
    let size: number
    try {
      const st = statSync(path)
      if (!st.isFile()) return null
      size = st.size
    } catch {
      return null
    }
    if (size > MAX_ATTACHMENT_BYTES) return null

    const name = safeFileName(basename(path))
    const self = this.opts.self()
    const msg: ChatMessage & { attachment: Attachment } = {
      id: randomUUID(),
      from: self.id,
      fromName: self.name,
      text: '',
      ts: Date.now(),
      attachment: { name, size, mime: guessMime(name) }
    }
    const { link } = this.opts
    if (!(await link.sendAsync({ t: 'file-start', msg }))) return null

    let sent = 0
    this.progress(msg.id, name, 'out', 0, size)
    try {
      for await (const chunk of createReadStream(path, { highWaterMark: CHUNK_BYTES })) {
        const buf = chunk as Buffer
        if (!(await link.sendAsync({ t: 'file-chunk', id: msg.id, data: buf.toString('base64') }))) return null
        sent += buf.length
        this.progress(msg.id, name, 'out', sent, size)
      }
      if (!(await link.sendAsync({ t: 'file-end', id: msg.id }))) return null
    } finally {
      this.done(msg.id)
    }

    const stored: StoredMessage = { ...msg, localPath: path }
    this.opts.history.append(stored)
    this.remember(stored)
    return stored
  }

  private readonly names = new Map<string, string>()

  private progress(id: string, name: string, direction: 'in' | 'out', done: number, total: number): void {
    this.names.set(id, name)
    this.opts.onProgress({ id, name, direction, done, total, finished: false })
  }

  private progressById(id: string, direction: 'in' | 'out', done: number, total: number): void {
    this.opts.onProgress({ id, name: this.names.get(id) ?? '', direction, done, total, finished: false })
  }

  private done(id: string): void {
    const name = this.names.get(id) ?? ''
    this.names.delete(id)
    this.opts.onProgress({ id, name, direction: 'in', done: 0, total: 0, finished: true })
  }

  private remember(m: StoredMessage): void {
    if (m.attachment && m.localPath) this.paths.set(m.id, { path: m.localPath, attachment: m.attachment })
  }
}
