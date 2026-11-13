import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  argbFromHex,
  hexFromArgb,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot
} from '@material/material-color-utilities'

const SEED = '#0F766E'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/renderer/src/theme/tokens.css')

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase()

const ROLES = [
  'background', 'onBackground', 'surface', 'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh',
  'surfaceContainerHighest', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'inverseSurface',
  'inverseOnSurface', 'outline', 'outlineVariant', 'shadow', 'scrim', 'surfaceTint',
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer'
]

function scheme(isDark) {
  const s = new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), isDark, 0)
  return ROLES.map((role) => `  --md-sys-color-${kebab(role)}: ${hexFromArgb(MaterialDynamicColors[role].getArgb(s))};`).join('\n')
}

const css = `/* gerado por scripts/theme.mjs a partir da semente ${SEED} */
:root {
  color-scheme: light dark;
${scheme(false)}
}

@media (prefers-color-scheme: dark) {
  :root {
${scheme(true).replace(/^/gm, '  ')}
  }
}
`

await writeFile(out, css)
console.log('theme ok:', out)
