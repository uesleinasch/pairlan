import type { RemoteInput } from '../shared/protocol'
import { evdevButton, evdevKey } from './keymap'

export type InputSink = {
  isActive(): boolean
  move(x: number, y: number): void
  button(code: number, down: boolean): void
  scroll(dx: number, dy: number): void
  key(code: number, down: boolean): void
}

export class RemoteControl {
  private keys = new Set<number>()
  private buttons = new Set<number>()

  constructor(private readonly sink: InputSink) {}

  apply(input: RemoteInput): void {
    if (!this.sink.isActive()) return
    switch (input.kind) {
      case 'move':
        this.sink.move(input.x, input.y)
        break
      case 'scroll':
        this.sink.scroll(input.dx, input.dy)
        break
      case 'button': {
        const code = evdevButton(input.button)
        if (code !== null) this.press(this.buttons, code, input.down, (c, d) => this.sink.button(c, d))
        break
      }
      case 'key': {
        const code = evdevKey(input.code)
        if (code !== null) this.press(this.keys, code, input.down, (c, d) => this.sink.key(c, d))
        break
      }
    }
  }

  releaseAll(): void {
    if (this.sink.isActive()) {
      this.keys.forEach((c) => this.sink.key(c, false))
      this.buttons.forEach((c) => this.sink.button(c, false))
    }
    this.keys.clear()
    this.buttons.clear()
  }

  private press(held: Set<number>, code: number, down: boolean, emit: (code: number, down: boolean) => void): void {
    if (!down && !held.has(code)) return
    if (down) held.add(code)
    else held.delete(code)
    emit(code, down)
  }
}
