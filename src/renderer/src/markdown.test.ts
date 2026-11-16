import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, markdownToHtml, parseBlocks, parseInline, type DomLike } from './markdown'

const txt = (v: string): DomLike => ({ nodeType: 3, nodeName: '#text', textContent: v, childNodes: [] })
const el = (name: string, ...kids: (DomLike | string)[]): DomLike => {
  const childNodes = kids.map((k) => (typeof k === 'string' ? txt(k) : k))
  return { nodeType: 1, nodeName: name, textContent: childNodes.map((c) => c.textContent).join(''), childNodes }
}
const a = (href: string, ...kids: (DomLike | string)[]): DomLike => ({ ...el('A', ...kids), getAttribute: (n) => (n === 'href' ? href : null) })

describe('parseInline', () => {
  it('reads bold, italic, strike, code and links', () => {
    expect(parseInline('a **b** _c_ *d* ~~e~~ `f` [g](https://x.io) https://y.io/p.')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'b', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'i', c: [{ t: 'text', v: 'c' }] },
      { t: 'text', v: ' ' },
      { t: 'i', c: [{ t: 'text', v: 'd' }] },
      { t: 'text', v: ' ' },
      { t: 's', c: [{ t: 'text', v: 'e' }] },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'f' },
      { t: 'text', v: ' ' },
      { t: 'link', href: 'https://x.io', c: [{ t: 'text', v: 'g' }] },
      { t: 'text', v: ' ' },
      { t: 'link', href: 'https://y.io/p', c: [{ t: 'text', v: 'https://y.io/p' }] },
      { t: 'text', v: '.' }
    ])
  })

  it('leaves snake_case, math and unsafe links alone', () => {
    expect(parseInline('foo_bar_baz 2*3*4 [x](javascript:alert(1))')).toEqual([{ t: 'text', v: 'foo_bar_baz 2*3*4 [x](javascript:alert(1))' }])
  })

  it('nests and keeps code literal', () => {
    expect(parseInline('**a _b_** `**c**`')).toEqual([
      { t: 'b', c: [{ t: 'text', v: 'a ' }, { t: 'i', c: [{ t: 'text', v: 'b' }] }] },
      { t: 'text', v: ' ' },
      { t: 'code', v: '**c**' }
    ])
  })
})

describe('parseBlocks', () => {
  it('groups paragraphs, lists and code', () => {
    const blocks = parseBlocks('título\nlinha 2\n- um\n- dois\n1. a\n2) b\nfim\n```\nx = 1\n```')
    expect(blocks.map((b) => b.t)).toEqual(['p', 'ul', 'ol', 'p', 'code'])
    expect(blocks[0]).toEqual({ t: 'p', c: [{ t: 'text', v: 'título\nlinha 2' }] })
    expect(blocks[1]).toEqual({ t: 'ul', items: [[{ t: 'text', v: 'um' }], [{ t: 'text', v: 'dois' }]] })
    expect(blocks[4]).toEqual({ t: 'code', v: 'x = 1' })
  })
})

describe('markdownToHtml', () => {
  it('escapes and builds editor html', () => {
    expect(markdownToHtml('**<b>** e `x`\n- [a](https://a.io)')).toBe(
      '<div><b>&lt;b&gt;</b> e <code>x</code></div><ul><li><a href="https://a.io">a</a></li></ul>'
    )
  })
})

describe('htmlToMarkdown', () => {
  it('turns editor dom into markdown', () => {
    const root = el(
      'DIV',
      'olá ',
      el('B', 'mundo '),
      el('DIV', el('I', 'ital'), ' e ', el('S', 'risco'), ' ', el('CODE', 'npm i')),
      el('UL', el('LI', 'um'), el('LI', el('B', 'dois'))),
      el('OL', el('LI', 'a'), el('LI', 'b')),
      el('PRE', 'x = 1\ny = 2'),
      el('DIV', a('https://x.io', 'site'), ' ', a('https://y.io', 'https://y.io'), ' ', a('javascript:x', 'mal')),
      el('DIV', el('BR')),
      el('DIV', 'fim')
    )
    expect(htmlToMarkdown(root)).toBe(
      'olá **mundo**\n_ital_ e ~~risco~~ `npm i`\n- um\n- **dois**\n1. a\n2. b\n```\nx = 1\ny = 2\n```\n[site](https://x.io) https://y.io mal\n\nfim'
    )
  })
})
