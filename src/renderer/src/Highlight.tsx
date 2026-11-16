import { splitMatches } from './notes'

export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitMatches(text, query).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : part.text))}
    </>
  )
}
