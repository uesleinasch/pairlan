import type { ChatMessage, PeerInfo, RemoteInput, SignalPayload } from './protocol'

export type AppConfig = {
  id: string
  name: string
  opacity: number
  alwaysOnTop: boolean
  notifyMinimized: boolean
  manualPeer: string
  liveAudio: boolean
  terminalMode: boolean
  terminalPath: string
  terminalBranch: string
}

export type LinkStatus =
  | { state: 'idle' | 'connecting'; peer: null; address: null }
  | { state: 'connected'; peer: PeerInfo; address: string | null }

export type InitialState = {
  self: PeerInfo
  config: AppConfig
  status: LinkStatus
  searching: boolean
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
  clearHistory(): Promise<void>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  connectManual(address: string): Promise<boolean>
  setSearching(searching: boolean): void
  onSearching(cb: (searching: boolean) => void): Unsubscribe
  onStatus(cb: (status: LinkStatus) => void): Unsubscribe
  onChat(cb: (msg: ChatMessage) => void): Unsubscribe
  onTyping(cb: () => void): Unsubscribe
  onConfig(cb: (config: AppConfig) => void): Unsubscribe
  sendSignal(payload: SignalPayload): void
  setSharing(sharing: boolean): void
  setShareCapture(size: { width: number; height: number } | null): void
  sendLaser(point: { x: number; y: number; click: boolean } | null): void
  setControl(allowed: boolean): Promise<{ ok: boolean; error?: string }>
  onControlState(cb: (allowed: boolean) => void): Unsubscribe
  onPeerControl(cb: (allowed: boolean) => void): Unsubscribe
  requestControl(): void
  onControlRequested(cb: () => void): Unsubscribe
  sendInput(input: RemoteInput): void
  onSignal(cb: (payload: SignalPayload) => void): Unsubscribe
  onRemoteSharing(cb: (sharing: boolean) => void): Unsubscribe
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
