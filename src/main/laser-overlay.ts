import { join } from 'node:path'
import { BrowserWindow, screen, type Display, type Rectangle } from 'electron'

export type CaptureSize = { width: number; height: number }

type DisplayLike = Pick<Display, 'bounds' | 'scaleFactor'>

export function pickDisplay<T extends DisplayLike>(displays: T[], primary: T, size: CaptureSize | null): T {
  if (!size) return primary
  const match = (d: T, scale: number) =>
    Math.abs(Math.round(d.bounds.width * scale) - size.width) <= 2 &&
    Math.abs(Math.round(d.bounds.height * scale) - size.height) <= 2
  return displays.find((d) => match(d, d.scaleFactor)) ?? displays.find((d) => match(d, 1)) ?? primary
}

export function toWindowPixel(display: Rectangle, win: Rectangle, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(display.x + x * display.width - win.x),
    y: Math.round(display.y + y * display.height - win.y)
  }
}

export class LaserOverlay {
  private win: BrowserWindow | null = null
  private capture: CaptureSize | null = null
  private display: Rectangle | null = null

  setCapture(size: CaptureSize | null): void {
    this.capture = size
    this.close()
  }

  point(x: number, y: number, click: boolean): void {
    const win = this.ensure()
    if (!win || !this.display) return
    const p = toWindowPixel(this.display, win.getBounds(), x, y)
    void win.webContents.executeJavaScript(`window.laser?.move(${p.x}, ${p.y}, ${click})`).catch(() => undefined)
  }

  hide(): void {
    if (this.win && !this.win.isDestroyed()) {
      void this.win.webContents.executeJavaScript('window.laser?.hide()').catch(() => undefined)
    }
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
    this.display = null
  }

  private ensure(): BrowserWindow | null {
    if (this.win && !this.win.isDestroyed()) return this.win
    const display = pickDisplay(screen.getAllDisplays(), screen.getPrimaryDisplay(), this.capture).bounds
    const win = new BrowserWindow({
      ...display,
      title: 'Notes',
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true }
    })
    win.setIgnoreMouseEvents(true)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true)
    win.once('ready-to-show', () => {
      win.setBounds(display)
      win.showInactive()
    })
    if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`)
    else void win.loadFile(join(__dirname, '../renderer/overlay.html'))
    this.win = win
    this.display = display
    return win
  }
}
