import type { ChatMessage, PeerInfo, SignalPayload } from './protocol'

export type AppConfig = {
  id: string
  name: string
  opacity: number
  alwaysOnTop: boolean
  notifications: boolean
  manualPeer: string
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
}
