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
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  connectManual: (address) => ipcRenderer.invoke('peer:connect', address),
  setSearching: (searching) => ipcRenderer.send('discovery:set', searching),
  onSearching: (cb) => listen('discovery:state', cb),
  onStatus: (cb) => listen('link:status', cb),
  onChat: (cb) => listen('chat:message', cb),
  onTyping: (cb) => listen('chat:typing', () => cb()),
  onConfig: (cb) => listen('config', cb),
  sendSignal: (payload) => ipcRenderer.send('rtc:signal', payload),
  setSharing: (sharing) => ipcRenderer.send('share:state', sharing),
  setShareCapture: (size) => ipcRenderer.send('share:capture', size),
  sendLaser: (point) => ipcRenderer.send('laser:send', point),
  setControl: (allowed) => ipcRenderer.invoke('control:set', allowed),
  onControlState: (cb) => listen('control:state', cb),
  onPeerControl: (cb) => listen('peer:control', cb),
  requestControl: () => ipcRenderer.send('control:request'),
  onControlRequested: (cb) => listen('control:requested', () => cb()),
  sendInput: (input) => ipcRenderer.send('input:send', input),
  onSignal: (cb) => listen('rtc:signal', cb),
  onRemoteSharing: (cb) => listen('share:remote', cb),
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
  stopSystemAudio: () => ipcRenderer.send('sysaudio:stop'),
  startWifiDirect: (peer) => ipcRenderer.invoke('wifi:start', peer),
  stopWifiDirect: () => ipcRenderer.send('wifi:stop'),
  onWifiDirect: (cb) => listen('wifi:status', cb),
  registerInternet: (username) => ipcRenderer.invoke('internet:register', username),
  addInternetPeer: (username) => ipcRenderer.invoke('internet:add-peer', username),
  removeInternetPeer: () => ipcRenderer.send('internet:remove-peer'),
  onInternet: (cb) => listen('internet:status', cb),
  onIceServers: (cb) => listen('rtc:ice-servers', cb),
  listSounds: () => ipcRenderer.invoke('sound:list'),
  soundData: () => ipcRenderer.invoke('sound:data'),
  pickSound: () => ipcRenderer.invoke('sound:pick'),
  onPlaySound: (cb) => listen('sound:play', () => cb()),
  sendAlert: (level) => ipcRenderer.send('alert:send', level),
  sendShake: () => ipcRenderer.send('alert:shake'),
  ackAlert: () => ipcRenderer.send('alert:ack'),
  onAlert: (cb) => listen('alert:incoming', cb),
  onShake: (cb) => listen('alert:shake', () => cb()),
  onAlertSeen: (cb) => listen('alert:seen', () => cb()),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  saveNote: (msg, hit = null) => ipcRenderer.invoke('notes:save', msg, hit),
  setNoteHit: (id, hit) => ipcRenderer.invoke('notes:hit', id, hit),
  setNoteComment: (id, comment) => ipcRenderer.invoke('notes:comment', id, comment),
  removeNote: (id) => ipcRenderer.invoke('notes:remove', id),
  restoreNote: (note) => ipcRenderer.invoke('notes:restore', note)
}

contextBridge.exposeInMainWorld('pairlan', api)
