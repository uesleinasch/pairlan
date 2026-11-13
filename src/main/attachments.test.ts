import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LinkStatus } from '../shared/api'
import { AttachmentService } from './attachments'
import { History } from './history'
import { PeerLink } from './peer-link'
import type { StoredMessage } from './transfer'

const links: PeerLink[] = []
afterEach(async () => {
  await Promise.all(links.splice(0).map((l) => l.stop()))
})

function peer(id: string) {
  const dir = mkdtempSync(join(tmpdir(), `pairlan-att-${id}-`))
  const link = new PeerLink({ id, name: id }, 0)
  const received: StoredMessage[] = []
  const service = new AttachmentService({
    link,
    history: new History(join(dir, 'history.jsonl')),
    dir: join(dir, 'files'),
    self: () => ({ id, name: id }),
    onMessage: (m) => received.push(m),
    onProgress: () => undefined
  })
  link.on('message', (m) => service.handleWire(m))
  links.push(link)
  return { dir, link, service, received }
}

describe('AttachmentService', () => {
  it('transfers a multi-chunk file between peers', async () => {
    const a = peer('a')
    const b = peer('b')
    await Promise.all([a.link.start(), b.link.start()])
    const up = new Promise<void>((resolve) =>
      a.link.on('status', (s: LinkStatus) => s.state === 'connected' && resolve())
    )
    a.link.connectTo('127.0.0.1', b.link.listeningPort())
    await up

    const content = randomBytes(700 * 1024)
    const source = join(a.dir, 'dump.bin')
    writeFileSync(source, content)

    const [sent] = await a.service.sendPaths([source])
    expect(sent.attachment).toMatchObject({ name: 'dump.bin', size: content.length })

    await expect.poll(() => b.received.length, { timeout: 5000 }).toBe(1)
    const got = b.received[0]
    expect(got.id).toBe(sent.id)
    expect(readFileSync(got.localPath!)).toEqual(content)
    expect(b.service.pathFor(sent.id)).toBe(got.localPath)
  })
})
