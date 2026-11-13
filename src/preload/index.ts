import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { PairlanApi } from '../shared/api'

function listen<T>(channel: string, cb: (payload: T) => void) {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

const api: PairlanApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  sendChat: (text) => ipcRenderer.invoke('chat:send', text),
  sendTyping: () => ipcRenderer.send('chat:typing'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  connectManual: (address) => ipcRenderer.invoke('peer:connect', address),
  onStatus: (cb) => listen('link:status', cb),
  onChat: (cb) => listen('chat:message', cb),
  onTyping: (cb) => listen('chat:typing', () => cb()),
  onConfig: (cb) => listen('config', cb)
}

contextBridge.exposeInMainWorld('pairlan', api)
