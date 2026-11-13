import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app, BrowserWindow, desktopCapturer, ipcMain, session } from 'electron'
import type { AppConfig } from '../shared/api'
import { parseWire, PROTOCOL_VERSION, type ChatMessage, type PeerInfo } from '../shared/protocol'
import { ConfigStore, DISCOVERY_PORT, runtimeOptions } from './config'
import { Discovery, shouldInitiate } from './discovery'
import { History } from './history'
import { parseAddress, PeerLink } from './peer-link'

const runtime = runtimeOptions(process.env)
if (runtime.profile) {
  app.setPath('userData', join(app.getPath('appData'), `pairlan-${runtime.profile}`))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(boot)
}

let win: BrowserWindow | null = null

function send(channel: string, payload?: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 400,
    title: 'Notes',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  w.once('ready-to-show', () => w.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    w.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    w.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return w
}

async function boot(): Promise<void> {
  const userData = app.getPath('userData')
  const config = new ConfigStore(userData)
  const history = new History(join(userData, 'history.jsonl'))
  const self = (): PeerInfo => ({ id: config.get().id, name: config.get().name })

  const link = new PeerLink(self(), runtime.linkPort)
  link.on('status', (status) => send('link:status', status))
  link.on('message', (m) => {
    switch (m.t) {
      case 'chat':
        history.append(m.msg)
        send('chat:message', m.msg)
        break
      case 'typing':
        send('chat:typing')
        break
      case 'signal':
        send('rtc:signal', m.payload)
        break
      case 'share-state':
        send('share:remote', m.sharing)
        break
    }
  })
  await link.start().catch((err) => console.error('[link] porta ocupada?', err.message))

  const discovery = new Discovery({
    port: DISCOVERY_PORT,
    beacon: () => ({ app: 'pairlan', v: PROTOCOL_VERSION, ...self(), linkPort: runtime.linkPort })
  })
  discovery.on('peer', (peer) => {
    if (shouldInitiate(self().id, peer.id)) link.connectTo(peer.address, peer.linkPort)
  })
  discovery.start()

  const manual = parseAddress(config.get().manualPeer, runtime.linkPort)
  if (manual) link.connectTo(manual.address, manual.port)

  ipcMain.handle('state:get', () => ({
    self: self(),
    config: config.get(),
    status: link.status(),
    history: history.load()
  }))

  ipcMain.handle('chat:send', (_e, text: unknown) => {
    if (typeof text !== 'string' || !text.trim() || !link.isConnected()) return null
    const msg: ChatMessage = { id: randomUUID(), from: self().id, fromName: self().name, text, ts: Date.now() }
    if (!link.send({ t: 'chat', msg })) return null
    history.append(msg)
    return msg
  })

  ipcMain.on('chat:typing', () => link.send({ t: 'typing' }))

  ipcMain.on('rtc:signal', (_e, payload: unknown) => {
    const m = parseWire(JSON.stringify({ t: 'signal', payload }))
    if (m) link.send(m)
  })

  ipcMain.on('share:state', (_e, sharing: unknown) => {
    if (typeof sharing === 'boolean') link.send({ t: 'share-state', sharing })
  })

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => (sources[0] ? callback({ video: sources[0] }) : callback({})))
      .catch(() => callback({}))
  })

  ipcMain.handle('config:set', (_e, patch: Partial<AppConfig>) => {
    const next = config.update(patch ?? {})
    link.updateSelf(self())
    send('config', next)
    return next
  })

  ipcMain.handle('peer:connect', (_e, input: unknown) => {
    const target = typeof input === 'string' ? parseAddress(input, runtime.linkPort) : null
    if (!target) return false
    config.update({ manualPeer: input as string })
    link.connectTo(target.address, target.port)
    return true
  })

  app.on('before-quit', () => {
    discovery.stop()
    void link.stop()
  })
  app.on('second-instance', () => win?.show())
  app.on('window-all-closed', () => app.quit())

  win = createWindow()
}
