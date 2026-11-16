import { parseBlocks, type Inline } from './markdown'

function InlineView({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return n.v
          case 'code':
            return <code key={i}>{n.v}</code>
          case 'b':
            return (
              <strong key={i}>
                <InlineView nodes={n.c} />
              </strong>
            )
          case 'i':
            return (
              <em key={i}>
                <InlineView nodes={n.c} />
              </em>
            )
          case 's':
            return (
              <s key={i}>
                <InlineView nodes={n.c} />
              </s>
            )
          case 'link':
            return (
              <a key={i} href={n.href} target="_blank" rel="noreferrer" title={n.href}>
                <InlineView nodes={n.c} />
              </a>
            )
        }
      })}
    </>
  )
}

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        if (block.t === 'code') {
          return (
            <pre key={i} className="code">
              {block.v}
            </pre>
          )
        }
        if (block.t === 'p') {
          return (
            <p key={i} className="text">
              <InlineView nodes={block.c} />
            </p>
          )
        }
        const List = block.t
        return (
          <List key={i} className="text-list">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineView nodes={item} />
              </li>
            ))}
          </List>
        )
      })}
    </>
  )
}
