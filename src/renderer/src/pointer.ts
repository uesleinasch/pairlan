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
