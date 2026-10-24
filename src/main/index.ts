import { app, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { LiveStore } from './live/store'
import { createLogger } from './log'
import { registerIpc } from './ipc'
import { createControlWindow } from './windows/control'

// 개발 중 여러 세션이 같은 앱을 동시에 띄울 수 있게 앱 데이터 폴더를 환경 변수로 바꾼다.
// 단일 실행 잠금도 앱 데이터 폴더마다 따로 잡힌다.
const userData = process.env['LLP_USER_DATA']
if (userData !== undefined && userData.length > 0) app.setPath('userData', userData)

const log = createLogger(join(app.getPath('userData'), 'logs'), { echo: !app.isPackaged })

// 처리하지 못한 예외는 기록하고 계속 돈다. 예배 중에 오류 대화상자를 띄우지 않는다.
process.on('uncaughtException', (error) => log.error('처리하지 못한 예외', error))
process.on('unhandledRejection', (reason) => log.error('처리하지 못한 거부', reason))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let control: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (control === null) return
    if (control.isMinimized()) control.restore()
    control.focus()
  })

  app.on('child-process-gone', (_event, details) => log.error('보조 프로세스가 끝났습니다', details))

  app
    .whenReady()
    .then(() => {
      const store = new LiveStore()
      const disposeIpc = registerIpc(store, log)
      const win = createControlWindow(log)
      control = win
      win.on('closed', () => {
        control = null
        disposeIpc()
        void log.flush().finally(() => app.quit())
      })
      log.info('시작했습니다', { version: app.getVersion(), electron: process.versions.electron })

      // 시험 운전과 CI에서 창이 뜨는지만 보고 끝낼 때 쓴다.
      const smokeMs = Number(process.env['LLP_SMOKE_EXIT_MS'] ?? '0')
      if (smokeMs > 0) {
        win.once('show', () => {
          setTimeout(() => {
            log.info('smoke ok')
            win.close()
          }, smokeMs)
        })
      }
    })
    .catch((error: unknown) => log.error('시작하지 못했습니다', error))

  app.on('window-all-closed', () => app.quit())
}
