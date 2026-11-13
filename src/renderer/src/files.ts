import type { ChatMessage } from '../../shared/protocol'
import { pastedFileName } from './format'

const api = window.pairlan

export async function sendFiles(files: File[]): Promise<ChatMessage[]> {
  const sent: ChatMessage[] = []
  const paths: string[] = []
  for (const file of files) {
    const path = api.pathForFile(file)
    if (path) paths.push(path)
    else sent.push(...(await api.sendFileData(file.name || pastedFileName(file.type), await file.arrayBuffer())))
  }
  if (paths.length) sent.push(...(await api.sendFilePaths(paths)))
  return sent
}

export function pastedFiles(e: ClipboardEvent | { clipboardData: DataTransfer }): File[] {
  return [...(e.clipboardData?.files ?? [])].map((f) => (f.name ? f : new File([f], pastedFileName(f.type), { type: f.type })))
}
