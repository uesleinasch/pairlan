import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import * as dbus from '@homebridge/dbus-native'

type Variant = [unknown, unknown[]]
type Dict = [string, Variant][]
type Options = [string, [string, unknown]][]
type DbusMessage = { type: number; path?: string; interface?: string; member?: string; body?: unknown[] }
type Bus = {
  name: string | null
  invoke(msg: Record<string, unknown>, cb: (err: unknown, value: unknown) => void): void
  connection: EventEmitter & { end(): void }
}

const SIGNAL = 4
const DEST = 'org.freedesktop.portal.Desktop'
const PATH = '/org/freedesktop/portal/desktop'
const RD = 'org.freedesktop.portal.RemoteDesktop'
const SC = 'org.freedesktop.portal.ScreenCast'
const DEVICE_KEYBOARD = 1
const DEVICE_POINTER = 2
const SOURCE_MONITOR = 1

export class PortalCancelled extends Error {}

export const unwrap = (v: Variant): unknown => v[1][0]

export function dictGet(dict: Dict, key: string): unknown {
  const entry = dict.find(([k]) => k === key)
  return entry ? unwrap(entry[1]) : undefined
}

export function parseStreams(results: Dict): { id: number; width: number; height: number }[] {
  const streams = dictGet(results, 'streams')
  if (!Array.isArray(streams)) return []
  return streams.flatMap((s) => {
    const [id, props] = s as [number, Dict]
    const size = dictGet(props, 'size')
    return Array.isArray(size) && size.length === 2 ? [{ id, width: Number(size[0]), height: Number(size[1]) }] : []
  })
}

export class RemoteDesktop extends EventEmitter<{ closed: [] }> {
  private bus: Bus | null = null
  private session: string | null = null
  private stream: { id: number; width: number; height: number } | null = null
  private waiters = new Map<string, (body: unknown[]) => void>()

  isActive(): boolean {
    return this.session !== null && this.stream !== null
  }

  async start(): Promise<void> {
    if (this.isActive()) return
    const bus = (dbus as unknown as { sessionBus(): Bus }).sessionBus()
    this.bus = bus
    bus.connection.on('message', (m: DbusMessage) => this.onSignal(m))
    try {
      await this.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'AddMatch', 's', [
        "type='signal',sender='org.freedesktop.portal.Desktop'"
      ])
      const created = await this.request(RD, 'CreateSession', 'a{sv}', (opts) => [
        [...opts, ['session_handle_token', ['s', token()]]]
      ])
      const session = String(dictGet(created, 'session_handle'))
      this.session = session
      await this.request(RD, 'SelectDevices', 'oa{sv}', (opts) => [
        session,
        [...opts, ['types', ['u', DEVICE_KEYBOARD | DEVICE_POINTER]]]
      ])
      await this.request(SC, 'SelectSources', 'oa{sv}', (opts) => [
        session,
        [...opts, ['types', ['u', SOURCE_MONITOR]], ['multiple', ['b', false]]]
      ])
      const started = await this.request(RD, 'Start', 'osa{sv}', (opts) => [session, '', opts])
      const stream = parseStreams(started)[0]
      if (!stream) throw new Error('O GNOME não devolveu a tela para o controle.')
      this.stream = stream
    } catch (err) {
      this.stop()
      throw err
    }
  }

  stop(): void {
    const { bus, session } = this
    this.session = null
    this.stream = null
    this.bus = null
    this.waiters.clear()
    if (!bus) return
    if (session) bus.invoke({ destination: DEST, path: session, interface: 'org.freedesktop.portal.Session', member: 'Close' }, () => bus.connection.end())
    else bus.connection.end()
  }

  move(x: number, y: number): void {
    if (!this.stream) return
    this.notify('NotifyPointerMotionAbsolute', 'oa{sv}udd', [this.stream.id, x * this.stream.width, y * this.stream.height])
  }

  button(code: number, down: boolean): void {
    this.notify('NotifyPointerButton', 'oa{sv}iu', [code, down ? 1 : 0])
  }

  scroll(dx: number, dy: number): void {
    if (dy) this.notify('NotifyPointerAxisDiscrete', 'oa{sv}ui', [0, dy])
    if (dx) this.notify('NotifyPointerAxisDiscrete', 'oa{sv}ui', [1, dx])
  }

  key(code: number, down: boolean): void {
    this.notify('NotifyKeyboardKeycode', 'oa{sv}iu', [code, down ? 1 : 0])
  }

  private notify(member: string, signature: string, args: unknown[]): void {
    if (!this.bus || !this.session) return
    this.bus.invoke({ destination: DEST, path: PATH, interface: RD, member, signature, body: [this.session, [], ...args] }, () => undefined)
  }

  private onSignal(m: DbusMessage): void {
    if (m.type !== SIGNAL || !m.path) return
    if (m.interface === 'org.freedesktop.portal.Request' && m.member === 'Response') {
      const waiter = this.waiters.get(m.path)
      this.waiters.delete(m.path)
      waiter?.(m.body ?? [])
    } else if (m.interface === 'org.freedesktop.portal.Session' && m.member === 'Closed' && m.path === this.session) {
      this.stop()
      this.emit('closed')
    }
  }

  private call(destination: string, path: string, iface: string, member: string, signature: string, body: unknown[]) {
    return new Promise<unknown>((resolve, reject) => {
      if (!this.bus) return reject(new Error('D-Bus fechado'))
      this.bus.invoke({ destination, path, interface: iface, member, signature, body }, (err, value) =>
        err ? reject(new Error(String((err as { message?: unknown }).message ?? err))) : resolve(value)
      )
    })
  }

  private async request(iface: string, member: string, signature: string, body: (opts: Options) => unknown[]): Promise<Dict> {
    const handle = token()
    const sender = (await this.uniqueName()).slice(1).replace(/\./g, '_')
    const path = `${PATH}/request/${sender}/${handle}`
    const response = new Promise<unknown[]>((resolve) => this.waiters.set(path, resolve))
    await this.call(DEST, PATH, iface, member, signature, body([['handle_token', ['s', handle]]]))
    const [code, results] = (await response) as [number, Dict]
    if (code === 1) throw new PortalCancelled('Controle remoto cancelado.')
    if (code !== 0) throw new Error('O GNOME recusou o controle remoto.')
    return results ?? []
  }

  private uniqueName(): Promise<string> {
    return new Promise((resolve, reject) => {
      const started = Date.now()
      const tick = () => {
        if (this.bus?.name) return resolve(this.bus.name)
        if (!this.bus || Date.now() - started > 5000) return reject(new Error('D-Bus não respondeu'))
        setTimeout(tick, 20)
      }
      tick()
    })
  }
}

const token = () => `pairlan_${randomUUID().replace(/-/g, '')}`
