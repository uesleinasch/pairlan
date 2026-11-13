export type TextPart = { kind: 'text' | 'code'; value: string }

export function splitFences(input: string): TextPart[] {
  const parts: TextPart[] = []
  const re = /```[^\n]*\n?([\s\S]*?)```/g
  let last = 0
  for (let m = re.exec(input); m; m = re.exec(input)) {
    if (m.index > last) parts.push({ kind: 'text', value: input.slice(last, m.index) })
    parts.push({ kind: 'code', value: m[1].replace(/\n$/, '') })
    last = re.lastIndex
  }
  if (last < input.length) parts.push({ kind: 'text', value: input.slice(last) })
  return parts.filter((p) => p.kind === 'code' || p.value.trim() !== '')
}
