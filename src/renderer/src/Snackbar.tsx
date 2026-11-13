import { useCallback, useEffect, useRef, useState } from 'react'

export type SnackbarAction = { label: string; run: () => void }
export type SnackbarItem = { id: number; text: string; action?: SnackbarAction; tone: 'info' | 'error' }

const HIDE_AFTER_MS = 6000

export function useSnackbar() {
  const [item, setItem] = useState<SnackbarItem | null>(null)
  const seq = useRef(0)

  const show = useCallback((text: string, action?: SnackbarAction, tone: SnackbarItem['tone'] = 'error') => {
    seq.current++
    setItem({ id: seq.current, text, action, tone })
  }, [])

  const dismiss = useCallback(() => setItem(null), [])

  useEffect(() => {
    if (!item) return
    const timer = window.setTimeout(dismiss, HIDE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [item, dismiss])

  return { item, show, dismiss }
}

export function Snackbar({ item, onDismiss }: { item: SnackbarItem | null; onDismiss: () => void }) {
  return (
    <div className="snackbar-region" role="status" aria-live="polite">
      {item && (
        <div className="snackbar" key={item.id}>
          <span className="type-body-medium">{item.text}</span>
          {item.action && (
            <md-text-button
              onClick={() => {
                item.action?.run()
                onDismiss()
              }}
            >
              {item.action.label}
            </md-text-button>
          )}
          <md-icon-button onClick={onDismiss} aria-label="Fechar aviso" title="Fechar">
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
      )}
    </div>
  )
}
