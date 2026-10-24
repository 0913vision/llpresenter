import type { LlpApi } from '../shared/ipc'

declare global {
  interface Window {
    /** Electron 밖(브라우저 미리보기)에서는 없다. */
    llp?: LlpApi
  }
}

export {}
