import { Highlight } from './Highlight'
import { parseBlocks, type Inline } from './markdown'

function InlineView({ nodes, query }: { nodes: Inline[]; query: string }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return query ? <Highlight key={i} text={n.v} query={query} /> : n.v
          case 'code':
            return (
              <code key={i}>
                <Highlight text={n.v} query={query} />
              </code>
            )
          case 'b':
            return (
              <strong key={i}>
                <InlineView nodes={n.c} query={query} />
              </strong>
            )
          case 'i':
            return (
              <em key={i}>
                <InlineView nodes={n.c} query={query} />
              </em>
            )
          case 's':
            return (
              <s key={i}>
                <InlineView nodes={n.c} query={query} />
              </s>
            )
          case 'link':
            return (
              <a key={i} href={n.href} target="_blank" rel="noreferrer" title={n.href}>
                <InlineView nodes={n.c} query={query} />
              </a>
            )
        }
      })}
    </>
  )
}

export function MessageText({ text, query = '' }: { text: string; query?: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        if (block.t === 'code') {
          return (
            <pre key={i} className="code">
              <Highlight text={block.v} query={query} />
            </pre>
          )
        }
        if (block.t === 'p') {
          return (
            <p key={i} className="text">
              <InlineView nodes={block.c} query={query} />
            </p>
          )
        }
        const List = block.t
        return (
          <List key={i} className="text-list">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineView nodes={item} query={query} />
              </li>
            ))}
          </List>
        )
      })}
    </>
  )
}
