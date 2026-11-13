import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'build/icon.svg'), 'utf8')
const unreadSvg = svg.replace(
  '</svg>',
  '<circle cx="424" cy="88" r="80" fill="#EF4444" stroke="#F0FDFA" stroke-width="24"/></svg>'
)

const iconsDir = join(root, 'build/icons')
const resourcesDir = join(root, 'resources')
await mkdir(iconsDir, { recursive: true })
await mkdir(resourcesDir, { recursive: true })

const render = (source, size, file) =>
  sharp(Buffer.from(source), { density: 384 }).resize(size, size).png().toFile(file)

await Promise.all([
  ...[16, 32, 48, 64, 128, 256, 512].map((s) => render(svg, s, join(iconsDir, `${s}x${s}.png`))),
  render(svg, 256, join(resourcesDir, 'icon.png')),
  render(svg, 32, join(resourcesDir, 'tray.png')),
  render(unreadSvg, 32, join(resourcesDir, 'tray-unread.png'))
])

console.log('icons ok')
