import { useEffect, useState } from 'react'
import type { Attachment } from '../../shared/protocol'
import { formatBytes } from './format'

const api = window.pairlan

const iconFor = (mime: string) =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'graphic_eq' : 'description'

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
      {preview && isImage && (
        <button type="button" className="attachment-preview" onClick={() => api.openFile(id)} aria-label={`Abrir ${attachment.name}`}>
          <img src={preview} alt={attachment.name} />
        </button>
      )}
      {preview && isAudio && <audio controls src={preview} preload="metadata" />}
      <div className="attachment-info">
        <md-icon aria-hidden="true">{iconFor(attachment.mime)}</md-icon>
        <span className="attachment-name type-body-medium" title={attachment.name}>
          {isAudio ? 'Mensagem de voz' : attachment.name}
        </span>
        <span className="type-body-small attachment-size">{formatBytes(attachment.size)}</span>
        <md-icon-button onClick={() => api.openFile(id)} aria-label="Abrir" title="Abrir">
          <md-icon>open_in_new</md-icon>
        </md-icon-button>
        <md-icon-button onClick={() => api.revealFile(id)} aria-label="Mostrar na pasta" title="Mostrar na pasta">
          <md-icon>folder_open</md-icon>
        </md-icon-button>
      </div>
    </div>
  )
}
