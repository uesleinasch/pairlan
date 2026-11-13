export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

function stamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function pastedFileName(mime: string, now = new Date()): string {
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg').replace(/[^\w]/g, '') || 'bin'
  return `colado-${stamp(now)}.${ext}`
}

export const voiceFileName = (now = new Date()): string => `voz-${stamp(now)}.webm`
