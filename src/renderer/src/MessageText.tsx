import { splitFences } from './text'

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {splitFences(text).map((part, i) =>
        part.kind === 'code' ? (
          <pre key={i} className="code">
            {part.value}
          </pre>
        ) : (
          <p key={i} className="text">
            {part.value}
          </p>
        )
      )}
    </>
  )
}
