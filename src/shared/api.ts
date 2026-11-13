import type { PeerInfo } from './protocol'

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
