import { splitFences } from './text'

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'b' | 'i' | 's'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'code'; v: string }

const INLINE =
  /`([^`\n]+)`|\*\*(\S(?:[\s\S]*?\S)?)\*\*|~~(\S(?:[\s\S]*?\S)?)~~|(?<![\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])|(?<!\w)_(\S(?:[^_\n]*?\S)?)_(?!\w)|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"])/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  const push = (node: Inline) => {
    const prev = out[out.length - 1]
    if (node.t === 'text' && prev?.t === 'text') prev.v += node.v
    else out.push(node)
  }
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) push({ t: 'text', v: text.slice(last, at) })
    if (m[1] !== undefined) push({ t: 'code', v: m[1] })
    else if (m[2] !== undefined) push({ t: 'b', c: parseInline(m[2]) })
    else if (m[3] !== undefined) push({ t: 's', c: parseInline(m[3]) })
    else if (m[4] !== undefined || m[5] !== undefined) push({ t: 'i', c: parseInline(m[4] ?? m[5]) })
    else if (m[6] !== undefined) push({ t: 'link', href: m[7], c: parseInline(m[6]) })
    else push({ t: 'link', href: m[8], c: [{ t: 'text', v: m[8] }] })
    last = at + m[0].length
  }
  if (last < text.length) push({ t: 'text', v: text.slice(last) })
  return out
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const part of splitFences(text)) {
    if (part.kind === 'code') {
      blocks.push({ t: 'code', v: part.value })
      continue
    }
    let para: string[] = []
    let list = null as { t: 'ul' | 'ol'; items: Inline[][] } | null
    const flushPara = () => {
      const body = para.join('\n').replace(/^\n+|\n+$/g, '')
      if (body.trim()) blocks.push({ t: 'p', c: parseInline(body) })
      para = []
    }
    const flushList = () => {
      if (list) blocks.push(list)
      list = null
    }
    for (const line of part.value.split('\n')) {
      const bullet = BULLET.exec(line)
      const numbered = bullet ? null : NUMBERED.exec(line)
      const kind = bullet ? 'ul' : numbered ? 'ol' : null
      if (kind) {
        flushPara()
        if (list?.t !== kind) {
          flushList()
          list = { t: kind, items: [] }
        }
        list.items.push(parseInline((bullet ?? numbered)![1]))
      } else {
        flushList()
        para.push(line)
      }
    }
    flushPara()
    flushList()
  }
  return blocks
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TAG = { b: 'b', i: 'i', s: 's' } as const

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.t === 'text') return esc(n.v).replace(/\n/g, '<br>')
      if (n.t === 'code') return `<code>${esc(n.v)}</code>`
      if (n.t === 'link') return `<a href="${esc(n.href)}">${inlineHtml(n.c)}</a>`
      return `<${TAG[n.t]}>${inlineHtml(n.c)}</${TAG[n.t]}>`
    })
    .join('')
}

export function markdownToHtml(text: string): string {
  return parseBlocks(text)
    .map((b) => {
      if (b.t === 'code') return `<pre>${esc(b.v)}</pre>`
      if (b.t === 'p') return `<div>${inlineHtml(b.c)}</div>`
      return `<${b.t}>${b.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</${b.t}>`
    })
    .join('')
}

export type DomLike = {
  nodeType: number
  nodeName: string
  textContent: string | null
  childNodes: ArrayLike<DomLike>
  getAttribute?: (name: string) => string | null
}

const WRAP: Record<string, string> = { B: '**', STRONG: '**', I: '_', EM: '_', S: '~~', STRIKE: '~~', DEL: '~~' }
const BLOCKS = new Set(['DIV', 'P', 'UL', 'OL', 'PRE', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'])

const hug = (inner: string, mark: string) => {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner
}

function walk(node: DomLike, out: { text: string }): void {
  const name = node.nodeName.toUpperCase()
  const kids = () => Array.from(node.childNodes)
  const inner = () => {
    const sub = { text: '' }
    for (const kid of kids()) walk(kid, sub)
    return sub.text
  }
  const breakLine = () => {
    if (out.text && !out.text.endsWith('\n')) out.text += '\n'
  }

  if (node.nodeType === 3) {
    out.text += (node.textContent ?? '').replace(/ /g, ' ')
    return
  }
  if (node.nodeType !== 1 && node.nodeType !== 11) return
  if (name === 'BR') {
    out.text += '\n'
    return
  }
  if (WRAP[name]) {
    out.text += hug(inner(), WRAP[name])
    return
  }
  if (name === 'CODE') {
    const code = (node.textContent ?? '').replace(/ /g, ' ')
    out.text += code.trim() ? `\`${code}\`` : code
    return
  }
  if (name === 'A') {
    const href = node.getAttribute?.('href') ?? ''
    const label = inner()
    out.text += /^https?:\/\//.test(href) && label.trim() ? (label === href ? href : `[${label}](${href})`) : label
    return
  }
  if (name === 'PRE') {
    breakLine()
    out.text += `\`\`\`\n${(node.textContent ?? '').replace(/ /g, ' ').replace(/\n$/, '')}\n\`\`\`\n`
    return
  }
  if (name === 'UL' || name === 'OL') {
    breakLine()
    let n = 0
    for (const kid of kids()) {
      if (kid.nodeName.toUpperCase() !== 'LI') continue
      const sub = { text: '' }
      for (const k of Array.from(kid.childNodes)) walk(k, sub)
      out.text += `${name === 'UL' ? '-' : `${++n}.`} ${sub.text.replace(/\n+$/, '').replace(/\n/g, ' ')}\n`
    }
    return
  }
  if (BLOCKS.has(name)) {
    breakLine()
    out.text += inner()
    breakLine()
    return
  }
  out.text += inner()
}

export function htmlToMarkdown(root: DomLike): string {
  const out = { text: '' }
  for (const kid of Array.from(root.childNodes)) walk(kid, out)
  return out.text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\s+$/g, '')
}
