export type Point = { x: number; y: number }

type Rect = { left: number; top: number; width: number; height: number }

export function videoPoint(rect: Rect, videoWidth: number, videoHeight: number, clientX: number, clientY: number): Point | null {
  if (!videoWidth || !videoHeight || !rect.width || !rect.height) return null
  const scale = Math.min(rect.width / videoWidth, rect.height / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  const x = (clientX - rect.left - (rect.width - width) / 2) / width
  const y = (clientY - rect.top - (rect.height - height) / 2) / height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

const LINE_PX = 40
const NOTCH_PX = 100

export function wheelSteps(delta: number, deltaMode: number): number {
  if (!delta) return 0
  const px = deltaMode === 1 ? delta * LINE_PX : deltaMode === 2 ? delta * 800 : delta
  const steps = Math.sign(px) * Math.max(1, Math.round(Math.abs(px) / NOTCH_PX))
  return Math.max(-20, Math.min(20, steps))
}
