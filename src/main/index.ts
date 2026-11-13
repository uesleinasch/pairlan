import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Notification,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import type { AppConfig } from '../shared/api'
import { parseWire, PROTOCOL_VERSION, type ChatMessage, type PeerInfo } from '../shared/protocol'
import { AttachmentService } from './attachments'
import { ConfigStore, DISCOVERY_PORT, runtimeOptions } from './config'
import { Discovery, shouldInitiate } from './discovery'
import { History } from './history'
import { parseAddress, PeerLink } from './peer-link'
import { SystemAudioSource } from './system-audio'
import { AppTray, resourcePath } from './tray'

const runtime = runtimeOptions(process.env)
if (runtime.profile) {
  app.setPath('userData', join(app.getPath('appData'), `pairlan-${runtime.profile}`))
}

// Wayland has no always-on-top; ozone is picked before this script runs, so appendSwitch is too late.
const needsX11 =
  process.platform === 'linux' && app.isPackaged && app.commandLine.getSwitchValue('ozone-platform') === 'wayland'

if (needsX11) {
  app.relaunch({ execPath: process.env.APPIMAGE, args: [...process.argv.slice(1), '--ozone-platform=x11'] })
  app.exit(0)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(boot)
}

let win: BrowserWindow | null = null
let quitting = false
let askingClose = false

async function askClose(): Promise<void> {
  if (!win || askingClose) return
  askingClose = true
  const { response } = await dialog
    .showMessageBox(win, {
      type: 'question',
      title: 'Fechar',
      message: 'Esconder na bandeja ou fechar o PairLAN?',
      detail: 'Na bandeja ele continua conectado e recebendo mensagens.',
      buttons: ['Esconder na bandeja', 'Fechar o PairLAN', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    .finally(() => (askingClose = false))
  if (response === 0) win?.hide()
  else if (response === 1) app.quit()
}

function send(channel: string, payload?: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function createWindow(alwaysOnTop: boolean): BrowserWindow {
  const w = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 400,
    title: 'Notes',
    icon: resourcePath('icon.png'),
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  w.setContentProtection(true)
  w.webContents.on('will-navigate', (e) => e.preventDefault())
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.once('ready-to-show', () => {
    w.show()
    w.setAlwaysOnTop(alwaysOnTop)
  })
  w.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    void askClose()
  })
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

  const toggleWindow = () => {
    if (!win) return
    if (win.isVisible() && win.isFocused()) win.hide()
    else {
      win.show()
      win.focus()
    }
  }
  const applyConfig = (patch: Partial<AppConfig>) => {
    const next = config.update(patch)
    link.updateSelf(self())
    win?.setAlwaysOnTop(next.alwaysOnTop)
    link.send({ t: 'presence', liveAudio: next.liveAudio })
    tray.rebuild()
    send('config', next)
    return next
  }

  const trayItems = (): MenuItemConstructorOptions[] => [
    {
      label: 'Opacidade',
      submenu: [1, 0.8, 0.6, 0.4].map((value) => ({
        label: `${Math.round(value * 100)}%`,
        type: 'radio' as const,
        checked: config.get().opacity === value,
        click: () => applyConfig({ opacity: value })
      }))
    },
    {
      label: 'Sempre no topo',
      type: 'checkbox',
      checked: config.get().alwaysOnTop,
      click: (item) => applyConfig({ alwaysOnTop: item.checked })
    }
  ]

  const tray = new AppTray({ toggleWindow, quit: () => app.quit(), extraItems: trayItems })

  const notifyIncoming = (msg: ChatMessage) => {
    if (win?.isVisible() && win.isFocused()) return
    tray.addUnread()
    if (config.get().notifications && Notification.isSupported()) {
      const body = msg.attachment ? `Anexo: ${msg.attachment.name}` : msg.text.slice(0, 140)
      new Notification({ title: msg.fromName, body }).show()
    }
  }

  const link = new PeerLink(self(), runtime.linkPort)
  const attachments = new AttachmentService({
    link,
    history,
    dir: join(app.getPath('downloads'), runtime.profile ? `PairLAN-${runtime.profile}` : 'PairLAN'),
    self,
    onMessage: (msg) => {
      send('chat:message', msg)
      notifyIncoming(msg)
    },
    onProgress: (p) => send('file:progress', p)
  })

  link.on('status', (status) => {
    if (status.state === 'connected') link.send({ t: 'presence', liveAudio: config.get().liveAudio })
    else attachments.abortIncoming()
    send('link:status', status)
  })
  link.on('message', (m) => {
    if (attachments.handleWire(m)) return
    switch (m.t) {
      case 'chat':
        history.append(m.msg)
        send('chat:message', m.msg)
        notifyIncoming(m.msg)
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
      case 'presence':
        send('peer:live-audio', m.liveAudio)
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
  const dialManualPeer = () => {
    const manual = parseAddress(config.get().manualPeer, runtime.linkPort)
    if (manual) link.connectTo(manual.address, manual.port)
  }
  discovery.start()
  dialManualPeer()

  ipcMain.on('discovery:set', (_e, searching: unknown) => {
    if (typeof searching !== 'boolean') return
    if (searching) {
      discovery.start()
      dialManualPeer()
    } else {
      discovery.stop()
      if (!link.isConnected()) link.cancelDial()
    }
    send('discovery:state', discovery.isRunning())
  })

  ipcMain.handle('state:get', () => ({
    self: self(),
    config: config.get(),
    status: link.status(),
    searching: discovery.isRunning(),
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

  ipcMain.handle('config:set', (_e, patch: Partial<AppConfig>) => applyConfig(patch ?? {}))

  ipcMain.handle('file:pick', async () => {
    if (!win || !link.isConnected()) return []
    const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
    return result.canceled ? [] : attachments.sendPaths(result.filePaths)
  })

  ipcMain.handle('file:send-paths', (_e, paths: unknown) => {
    if (!Array.isArray(paths) || !link.isConnected()) return []
    return attachments.sendPaths(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))
  })

  ipcMain.handle('file:send-data', (_e, name: unknown, data: unknown) => {
    if (typeof name !== 'string' || !(data instanceof ArrayBuffer) || !link.isConnected()) return []
    return attachments.sendData(name, data)
  })

  ipcMain.on('file:open', (_e, id: unknown) => {
    const path = typeof id === 'string' ? attachments.pathFor(id) : null
    if (path) void shell.openPath(path)
  })

  ipcMain.on('file:reveal', (_e, id: unknown) => {
    const path = typeof id === 'string' ? attachments.pathFor(id) : null
    if (path) shell.showItemInFolder(path)
  })

  ipcMain.handle('file:preview', (_e, id: unknown) => (typeof id === 'string' ? attachments.preview(id) : null))

  const systemAudio = new SystemAudioSource(process.pid)
  ipcMain.handle('sysaudio:start', () => systemAudio.start())
  ipcMain.on('sysaudio:stop', () => systemAudio.stop())


  ipcMain.handle('peer:connect', (_e, input: unknown) => {
    const target = typeof input === 'string' ? parseAddress(input, runtime.linkPort) : null
    if (!target) return false
    config.update({ manualPeer: input as string })
    link.connectTo(target.address, target.port)
    return true
  })

  app.on('before-quit', () => {
    quitting = true
    systemAudio.stop()
    discovery.stop()
    void link.stop()
  })
  app.on('second-instance', () => win?.show())

  win = createWindow(config.get().alwaysOnTop)
  win.on('focus', () => tray.clearUnread())
}
