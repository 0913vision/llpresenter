// 창과 메인 사이의 통로. 들어오는 값은 모두 검사하고, 틀린 값은 기록하고 버린다.
// 돌려주는 함수로 등록한 것을 모두 푼다.

import { BrowserWindow, ipcMain } from 'electron'
import { isLiveCommand } from '@shared/commands'
import { Channels, windowActions, type WindowAction } from '@shared/ipc'
import type { LiveState } from '@shared/live'
import type { Logger } from './log'
import type { LiveStore } from './live/store'

function isWindowAction(value: unknown): value is WindowAction {
  return windowActions.some((action) => action === value)
}

function broadcast(state: LiveState, log: Logger): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue
    try {
      win.webContents.send(Channels.liveChanged, state)
    } catch (error) {
      log.warn('창에 출력 상태를 보내지 못했습니다', error)
    }
  }
}

export function registerIpc(store: LiveStore, log: Logger): () => void {
  ipcMain.handle(Channels.liveGet, () => store.state)

  ipcMain.on(Channels.liveCommand, (_event, value: unknown) => {
    if (!isLiveCommand(value)) {
      log.warn('모양이 틀린 명령을 버렸습니다', value)
      return
    }
    store.dispatch(value, (error) => log.error('출력 상태 구독자에서 오류가 났습니다', error))
  })

  ipcMain.on(Channels.windowControl, (event, value: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win === null || !isWindowAction(value)) return
    switch (value) {
      case 'minimize':
        win.minimize()
        return
      case 'toggle-maximize':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        return
      case 'close':
        win.close()
        return
    }
  })

  const unsubscribe = store.subscribe((state) => broadcast(state, log))

  return () => {
    unsubscribe()
    ipcMain.removeHandler(Channels.liveGet)
    ipcMain.removeAllListeners(Channels.liveCommand)
    ipcMain.removeAllListeners(Channels.windowControl)
  }
}
