import type { PairlanApi } from '../shared/api'

declare global {
  interface Window {
    pairlan: PairlanApi
  }
}
