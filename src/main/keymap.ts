const LETTERS: Record<string, number> = {
  Q: 16, W: 17, E: 18, R: 19, T: 20, Y: 21, U: 22, I: 23, O: 24, P: 25,
  A: 30, S: 31, D: 32, F: 33, G: 34, H: 35, J: 36, K: 37, L: 38,
  Z: 44, X: 45, C: 46, V: 47, B: 48, N: 49, M: 50
}

const DIGITS = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const NAMED: Record<string, number> = {
  Escape: 1, Minus: 12, Equal: 13, Backspace: 14, Tab: 15,
  BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  Semicolon: 39, Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43,
  Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55,
  AltLeft: 56, Space: 57, CapsLock: 58, NumLock: 69, ScrollLock: 70,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74,
  Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
  Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82, NumpadDecimal: 83,
  IntlBackslash: 86, F11: 87, F12: 88, IntlRo: 89,
  NumpadEnter: 96, ControlRight: 97, NumpadDivide: 98, PrintScreen: 99, AltRight: 100,
  Home: 102, ArrowUp: 103, PageUp: 104, ArrowLeft: 105, ArrowRight: 106,
  End: 107, ArrowDown: 108, PageDown: 109, Insert: 110, Delete: 111,
  NumpadEqual: 117, Pause: 119, NumpadComma: 121,
  MetaLeft: 125, MetaRight: 126, ContextMenu: 127
}

export function evdevKey(code: string): number | null {
  if (Object.hasOwn(NAMED, code)) return NAMED[code]
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return LETTERS[letter[1]]
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return DIGITS[Number(digit[1])]
  const fn = /^F(\d{1,2})$/.exec(code)
  if (fn && Number(fn[1]) >= 1 && Number(fn[1]) <= 10) return 58 + Number(fn[1])
  return null
}

export const evdevButton = (button: number): number | null => [0x110, 0x112, 0x111][button] ?? null
