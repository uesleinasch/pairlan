import { useLayoutEffect, useRef } from 'react'

type Props = {
  label: string
  icon: string
  selected: boolean
  disabled?: boolean
  title: string
  onToggle: () => void
}

export function ToggleChip({ label, icon, selected, disabled = false, title, onToggle }: Props) {
  const ref = useRef<HTMLElement & { selected: boolean }>(null)

  useLayoutEffect(() => {
    if (ref.current) ref.current.selected = selected
  })

  return (
    <md-filter-chip
      ref={ref}
      label={label}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={() => {
        if (ref.current) ref.current.selected = selected
        onToggle()
      }}
    >
      <md-icon slot="icon">{icon}</md-icon>
    </md-filter-chip>
  )
}
