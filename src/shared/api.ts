import type { ChatMessage, PeerInfo, SignalPayload } from './protocol'

export type AppConfig = {
  id: string
  name: string
  opacity: number
  alwaysOnTop: boolean
  notifications: boolean
  manualPeer: string
  liveAudio: boolean
}

export type LinkStatus =
  | { state: 'idle' | 'connecting'; peer: null; address: null }
  | { state: 'connected'; peer: PeerInfo; address: string | null }

export type InitialState = {
  self: PeerInfo
  config: AppConfig
  status: LinkStatus
  history: ChatMessage[]
}

export type Unsubscribe = () => void

export type SystemAudioResult = { ok: true; label: string } | { ok: false; error: string }

export type TransferProgress = {
  id: string
  name: string
  direction: 'in' | 'out'
  done: number
  total: number
  finished: boolean
}

export type PairlanApi = {
  getState(): Promise<InitialState>
  sendChat(text: string): Promise<ChatMessage | null>
  sendTyping(): void
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  connectManual(address: string): Promise<boolean>
  onStatus(cb: (status: LinkStatus) => void): Unsubscribe
  onChat(cb: (msg: ChatMessage) => void): Unsubscribe
  onTyping(cb: () => void): Unsubscribe
  onConfig(cb: (config: AppConfig) => void): Unsubscribe
  sendSignal(payload: SignalPayload): void
  setSharing(sharing: boolean): void
  onSignal(cb: (payload: SignalPayload) => void): Unsubscribe
  onRemoteSharing(cb: (sharing: boolean) => void): Unsubscribe
  minimizeWindow(): void
  hideWindow(): void
  pickFiles(): Promise<ChatMessage[]>
  sendFilePaths(paths: string[]): Promise<ChatMessage[]>
  sendFileData(name: string, data: ArrayBuffer): Promise<ChatMessage[]>
  pathForFile(file: File): string
  openFile(id: string): void
  revealFile(id: string): void
  previewFile(id: string): Promise<string | null>
  onTransfer(cb: (progress: TransferProgress) => void): Unsubscribe
  onPeerLiveAudio(cb: (liveAudio: boolean) => void): Unsubscribe
  startSystemAudio(): Promise<SystemAudioResult>
  stopSystemAudio(): void
}
