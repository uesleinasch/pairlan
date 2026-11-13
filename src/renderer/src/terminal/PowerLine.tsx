export function PowerLine({ path, branch }: { path: string; branch: string }) {
  const cut = path.lastIndexOf('/')
  const head = cut >= 0 ? path.slice(0, cut + 1) : ''
  const last = cut >= 0 ? path.slice(cut + 1) : path
  return (
    <p className="term-line term-pl" aria-hidden="true">
      <span className="term-pl-path">
        {head}
        <b>{last}</b>
      </span>
      <span className="term-pl-sep" />
      <span className="term-pl-git">{branch}</span>
      <span className="term-pl-fade">▓▒░</span>
    </p>
  )
}
