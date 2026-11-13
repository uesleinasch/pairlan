import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import 'material-symbols/outlined.css'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/chips/chip-set.js'
import '@material/web/chips/filter-chip.js'
import '@material/web/dialog/dialog.js'
import '@material/web/divider/divider.js'
import '@material/web/icon/icon.js'
import '@material/web/iconbutton/filled-icon-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/list/list-item.js'
import '@material/web/list/list.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/focus/md-focus-ring.js'
import '@material/web/ripple/ripple.js'
import '@material/web/slider/slider.js'
import '@material/web/switch/switch.js'
import '@material/web/textfield/outlined-text-field.js'

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MdElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [prop: string]: unknown
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MdElement
      'md-filled-tonal-button': MdElement
      'md-text-button': MdElement
      'md-chip-set': MdElement
      'md-filter-chip': MdElement
      'md-dialog': MdElement
      'md-divider': MdElement
      'md-icon': MdElement
      'md-filled-icon-button': MdElement
      'md-icon-button': MdElement
      'md-list': MdElement
      'md-list-item': MdElement
      'md-linear-progress': MdElement
      'md-slider': MdElement
      'md-switch': MdElement
      'md-outlined-text-field': MdElement
      'md-focus-ring': MdElement
      'md-ripple': MdElement
    }
  }
}
