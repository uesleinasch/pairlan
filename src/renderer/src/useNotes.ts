import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HitLevel, Note } from '../../shared/notes'
import type { ChatMessage } from '../../shared/protocol'

const api = window.pairlan

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    void api.listNotes().then(setNotes)
  }, [])

  const byMessage = useMemo(() => new Map(notes.map((n) => [n.messageId, n])), [notes])

  const save = useCallback((msg: ChatMessage, hit: HitLevel | null = null) => api.saveNote(msg, hit).then(setNotes), [])
  const setHit = useCallback((id: string, hit: HitLevel | null) => api.setNoteHit(id, hit).then(setNotes), [])
  const setComment = useCallback((id: string, comment: string) => api.setNoteComment(id, comment).then(setNotes), [])
  const remove = useCallback((id: string) => api.removeNote(id).then(setNotes), [])
  const restore = useCallback((note: Note) => api.restoreNote(note).then(setNotes), [])

  const toggleHit = useCallback(
    (msg: ChatMessage, hit: HitLevel) => {
      const note = byMessage.get(msg.id)
      return note?.hit === hit ? setHit(note.id, null) : save(msg, hit)
    },
    [byMessage, save, setHit]
  )

  return { notes, byMessage, save, setHit, setComment, remove, restore, toggleHit }
}

export type NotesApi = ReturnType<typeof useNotes>

export const copyText = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  )

export function flashElement(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ block: 'center' })
  el.classList.remove('flash')
  void el.offsetWidth
  el.classList.add('flash')
  window.setTimeout(() => el.classList.remove('flash'), 1800)
  return true
}
