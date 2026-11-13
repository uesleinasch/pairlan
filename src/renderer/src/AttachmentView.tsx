import { useEffect, useState } from 'react'
import type { Attachment } from '../../shared/protocol'
import { formatBytes } from './format'

const api = window.pairlan

export function AttachmentView({ id, attachment }: { id: string; attachment: Attachment }) {
  const [preview, setPreview] = useState<string | null>(null)

  const isImage = attachment.mime.startsWith('image/')
  const isAudio = attachment.mime.startsWith('audio/')

  useEffect(() => {
    if (!isImage && !isAudio) return
    let alive = true
    void api.previewFile(id).then((url) => alive && setPreview(url))
    return () => {
      alive = false
    }
  }, [id, isImage, isAudio])

  return (
    <div className="attachment">
      {preview && isImage && <img src={preview} alt={attachment.name} onClick={() => api.openFile(id)} />}
      {preview && isAudio && <audio controls src={preview} preload="metadata" />}
      <div className="attachment-info">
        <span className="attachment-name" title={attachment.name}>
          📎 {attachment.name}
        </span>
        <span className="attachment-size">{formatBytes(attachment.size)}</span>
        <button className="ghost" onClick={() => api.openFile(id)}>
          Abrir
        </button>
        <button className="ghost" onClick={() => api.revealFile(id)}>
          Pasta
        </button>
      </div>
    </div>
  )
}
