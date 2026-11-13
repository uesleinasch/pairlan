import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
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
  onConfig: (cb) => listen('config', cb),
  sendSignal: (payload) => ipcRenderer.send('rtc:signal', payload),
  setSharing: (sharing) => ipcRenderer.send('share:state', sharing),
  onSignal: (cb) => listen('rtc:signal', cb),
  onRemoteSharing: (cb) => listen('share:remote', cb),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  pickFiles: () => ipcRenderer.invoke('file:pick'),
  sendFilePaths: (paths) => ipcRenderer.invoke('file:send-paths', paths),
  sendFileData: (name, data) => ipcRenderer.invoke('file:send-data', name, data),
  pathForFile: (file) => webUtils.getPathForFile(file),
  openFile: (id) => ipcRenderer.send('file:open', id),
  revealFile: (id) => ipcRenderer.send('file:reveal', id),
  previewFile: (id) => ipcRenderer.invoke('file:preview', id),
  onTransfer: (cb) => listen('file:progress', cb),
  onPeerLiveAudio: (cb) => listen('peer:live-audio', cb),
  startSystemAudio: () => ipcRenderer.invoke('sysaudio:start'),
  stopSystemAudio: () => ipcRenderer.send('sysaudio:stop')
}

contextBridge.exposeInMainWorld('pairlan', api)
