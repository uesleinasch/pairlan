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
  private readonly icon = nativeImage.createFromPath(resourcePath('tray.png'))
  private readonly unreadIcon = nativeImage.createFromPath(resourcePath('tray-unread.png'))
  private unread = 0

  constructor(private readonly opts: Options) {
    this.tray = new Tray(this.icon)
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

  private setUnread(n: number): void {
    if (n === this.unread) return
    this.unread = n
    this.tray.setImage(n ? this.unreadIcon : this.icon)
    this.rebuild()
  }
}
