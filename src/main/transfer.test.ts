import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileReceiver, guessMime, safeFileName, uniquePath } from './transfer'

const dir = () => mkdtempSync(join(tmpdir(), 'pairlan-t-'))

const message = (id: string, name: string, size: number) => ({
  id,
  from: 'a',
  fromName: 'Ana',
  text: '',
  ts: 1,
  attachment: { name, size, mime: 'text/plain' }
})

describe('file names', () => {
  it('strips paths and unsafe characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('C:\\Users\\x\\print?.png')).toBe('print_.png')
    expect(safeFileName('..')).toBe('arquivo')
    expect(safeFileName('.bashrc')).toBe('arquivo.bashrc')
  })

  it('avoids overwriting existing files', () => {
    const d = dir()
    writeFileSync(join(d, 'a.txt'), '')
    writeFileSync(join(d, 'a (1).txt'), '')
    expect(uniquePath(d, 'a.txt')).toBe(join(d, 'a (2).txt'))
    expect(uniquePath(d, 'b.txt')).toBe(join(d, 'b.txt'))
  })

  it('guesses common mime types', () => {
    expect(guessMime('Print.PNG')).toBe('image/png')
    expect(guessMime('voz-1.webm')).toBe('audio/webm')
    expect(guessMime('x.unknown')).toBe('application/octet-stream')
  })
})

describe('FileReceiver', () => {
  it('assembles chunks into the final file', async () => {
    const d = dir()
    const r = new FileReceiver(d)
    r.start(message('1', 'nota.txt', 11))
    expect(r.chunk('1', Buffer.from('hello ').toString('base64'))).toEqual({ received: 6, total: 11 })
    r.chunk('1', Buffer.from('world').toString('base64'))
    const done = await r.end('1')
    expect(done?.localPath).toBe(join(d, 'nota.txt'))
    expect(readFileSync(join(d, 'nota.txt'), 'utf8')).toBe('hello world')
    expect(readdirSync(d)).toEqual(['nota.txt'])
  })

  it('discards incomplete or oversized transfers', async () => {
    const d = dir()
    const r = new FileReceiver(d)
    r.start(message('2', 'curto.txt', 10))
    r.chunk('2', Buffer.from('abc').toString('base64'))
    expect(await r.end('2')).toBeNull()

    r.start(message('3', 'grande.txt', 2))
    expect(r.chunk('3', Buffer.from('abc').toString('base64'))).toBeNull()
    expect(await r.end('3')).toBeNull()

    r.start(message('4', 'abortado.txt', 5))
    r.abortAll()
    await new Promise((res) => setTimeout(res, 20))
    expect(readdirSync(d)).toEqual([])
    expect(existsSync(join(d, 'curto.txt'))).toBe(false)
  })
})
