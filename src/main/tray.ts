import { join } from 'node:path'
import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'

export const resourcePath = (file: string): string =>
  app.isPackaged ? join(process.resourcesPath, 'resources', file) : join(app.getAppPath(), 'resources', file)

type Options = {
  toggleWindow: () => void
  quit: () => void
  extraItems?: () => MenuItemConstructorOptions[]
}

export class AppTray {
  private readonly tray: Tray
  private readonly icons = {
    normal: nativeImage.createFromPath(resourcePath('tray.png')),
    normalUnread: nativeImage.createFromPath(resourcePath('tray-unread.png')),
    terminal: nativeImage.createFromPath(resourcePath('terminal-tray.png')),
    terminalUnread: nativeImage.createFromPath(resourcePath('terminal-tray-unread.png'))
  }
  private unread = 0
  private terminal = false

  constructor(private readonly opts: Options) {
    this.tray = new Tray(this.icons.normal)
    this.tray.setToolTip('Notes')
    this.tray.on('click', opts.toggleWindow)
    this.rebuild()
  }

  addUnread(): void {
    this.setUnread(this.unread + 1)
  }

  clearUnread(): void {
    this.setUnread(0)
  }

  rebuild(): void {
    const items: MenuItemConstructorOptions[] = [
      { label: this.unread ? `Mostrar / esconder (${this.unread} nova(s))` : 'Mostrar / esconder', click: this.opts.toggleWindow },
      ...(this.opts.extraItems?.() ?? []),
      { type: 'separator' },
      { label: 'Sair', click: this.opts.quit }
    ]
    this.tray.setContextMenu(Menu.buildFromTemplate(items))
  }

  setTerminal(on: boolean): void {
    if (on === this.terminal) return
    this.terminal = on
    this.tray.setToolTip(on ? 'Terminal' : 'Notes')
    this.refreshIcon()
  }

  private setUnread(n: number): void {
    if (n === this.unread) return
    this.unread = n
    this.refreshIcon()
    this.rebuild()
  }

  private refreshIcon(): void {
    const { icons, terminal, unread } = this
    this.tray.setImage(terminal ? (unread ? icons.terminalUnread : icons.terminal) : unread ? icons.normalUnread : icons.normal)
  }
}
