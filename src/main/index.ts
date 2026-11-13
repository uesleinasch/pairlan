import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  Notification,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import type { AppConfig } from '../shared/api'
import { parseInput, parseWire, PROTOCOL_VERSION, type ChatMessage, type PeerInfo } from '../shared/protocol'
import { AttachmentService } from './attachments'
import { ConfigStore, DISCOVERY_PORT, runtimeOptions, windowLook, type WindowLook } from './config'
import { Discovery, shouldInitiate } from './discovery'
import { History } from './history'
import { LaserOverlay } from './laser-overlay'
import { parseAddress, PeerLink } from './peer-link'
import { RemoteControl } from './remote-control'
import { PortalCancelled, RemoteDesktop } from './remote-desktop'
import { SystemAudioSource } from './system-audio'
import { AppTray, resourcePath } from './tray'

const runtime = runtimeOptions(process.env)
if (runtime.profile) {
  app.setPath('userData', join(app.getPath('appData'), `pairlan-${runtime.profile}`))
}

// Wayland has no always-on-top; ozone is picked before this script runs, so appendSwitch is too late.
// app.relaunch breaks inside an AppImage (the mount goes away), so this process stays alive as a supervisor.
const needsX11 =
  process.platform === 'linux' && app.isPackaged && app.commandLine.getSwitchValue('ozone-platform') === 'wayland'

if (needsX11) {
  app.disableHardwareAcceleration()
  const child = spawn(process.execPath, [...process.argv.slice(1), '--ozone-platform=x11'], { stdio: 'inherit' })
  child.on('exit', (code) => app.exit(code ?? 0))
  child.on('error', () => app.exit(1))
  app.on('before-quit', () => child.kill())
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

function createWindow(alwaysOnTop: boolean, look: WindowLook): BrowserWindow {
  const w = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 400,
    title: look.title,
    icon: resourcePath(look.icon),
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
  w.on('page-title-updated', (e) => e.preventDefault())
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
  Menu.setApplicationMenu(null)
  const userData = app.getPath('userData')
  const config = new ConfigStore(userData)
  const history = new History(join(userData, 'history.jsonl'))
  const self = (): PeerInfo => ({ id: config.get().id, name: config.get().name })
  const applyLook = (c: AppConfig) => {
    const look = windowLook(c)
    win?.setTitle(look.title)
    win?.setIcon(resourcePath(look.icon))
    tray.setTerminal(c.terminalMode)
  }

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
    applyLook(next)
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
    },
    {
      label: 'Modo terminal',
      type: 'checkbox',
      checked: config.get().terminalMode,
      click: (item) => applyConfig({ terminalMode: item.checked })
    }
  ]

  const tray = new AppTray({ toggleWindow, quit: () => app.quit(), extraItems: trayItems })
  tray.setTerminal(config.get().terminalMode)

  const notifyIncoming = (msg: ChatMessage) => {
    if (win?.isVisible() && win.isFocused()) return
    tray.addUnread()
    const minimized = !win || !win.isVisible() || win.isMinimized()
    if (!minimized || !config.get().notifyMinimized || !Notification.isSupported()) return
    const notification = config.get().terminalMode
      ? new Notification({ title: 'Terminal', body: 'Comando concluído' })
      : new Notification({
          title: msg.fromName,
          body: msg.attachment ? `Anexo: ${msg.attachment.name}` : msg.text.slice(0, 140)
        })
    notification.on('click', () => {
      win?.show()
      win?.focus()
    })
    notification.show()
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

  const laser = new LaserOverlay()
  let sharingScreen = false
  const portal = new RemoteDesktop()
  const remote = new RemoteControl(portal)
  let controlAllowed = false

  const setControl = (allowed: boolean) => {
    if (!allowed) {
      remote.releaseAll()
      portal.stop()
    }
    const changed = controlAllowed !== allowed
    controlAllowed = allowed
    if (changed) link.send({ t: 'control-state', allowed })
    send('control:state', allowed)
  }
  portal.on('closed', () => setControl(false))

  link.on('status', (status) => {
    if (status.state === 'connected') link.send({ t: 'presence', liveAudio: config.get().liveAudio })
    else {
      attachments.abortIncoming()
      sharingScreen = false
      laser.close()
      setControl(false)
      send('peer:control', false)
    }
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
      case 'laser':
        if (sharingScreen) laser.point(m.x, m.y, m.click)
        break
      case 'laser-off':
        laser.hide()
        break
      case 'control-state':
        send('peer:control', m.allowed)
        break
      case 'control-request':
        if (!controlAllowed) send('control:requested')
        break
      case 'input':
        if (controlAllowed) remote.apply(m.input)
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
    if (typeof sharing !== 'boolean') return
    sharingScreen = sharing
    if (!sharing) {
      laser.close()
      setControl(false)
    }
    link.send({ t: 'share-state', sharing })
  })

  ipcMain.handle('control:set', async (_e, allowed: unknown) => {
    if (allowed !== true) {
      setControl(false)
      return { ok: true }
    }
    if (!sharingScreen || !link.isConnected()) return { ok: false, error: 'Compartilhe a tela antes de liberar o controle.' }
    try {
      await portal.start()
      if (!sharingScreen || !link.isConnected()) throw new Error('A tela parou de ser compartilhada.')
      setControl(true)
      return { ok: true }
    } catch (err) {
      setControl(false)
      if (err instanceof PortalCancelled) return { ok: false, error: '' }
      return { ok: false, error: err instanceof Error ? err.message : 'Falha ao liberar o controle.' }
    }
  })

  ipcMain.on('control:request', () => link.send({ t: 'control-request' }))

  ipcMain.on('input:send', (_e, input: unknown) => {
    const parsed = parseInput(input)
    if (parsed) link.send({ t: 'input', input: parsed })
  })

  ipcMain.on('share:capture', (_e, size: unknown) => {
    const ok = (v: unknown) => Number.isInteger(v) && (v as number) > 0
    const s = size as { width?: unknown; height?: unknown } | null
    laser.setCapture(s && ok(s.width) && ok(s.height) ? { width: s.width as number, height: s.height as number } : null)
  })

  ipcMain.on('laser:send', (_e, point: unknown) => {
    const m = parseWire(JSON.stringify(point ? { ...(point as object), t: 'laser' } : { t: 'laser-off' }))
    if (m) link.send(m)
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
    laser.close()
    setControl(false)
    systemAudio.stop()
    discovery.stop()
    void link.stop()
  })
  app.on('second-instance', () => win?.show())

  win = createWindow(config.get().alwaysOnTop, windowLook(config.get()))
  win.on('focus', () => tray.clearUnread())
}
