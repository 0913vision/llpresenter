import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Channels, type LlpApi, type Unsubscribe } from '@shared/ipc'
import type { LiveState } from '@shared/live'

function listen(channel: string, listener: (state: LiveState) => void): Unsubscribe {
  // 메인이 보낸 값만 받는다. 모양 검사는 메인이 이미 한 상태를 그대로 믿는다.
  const handler = (_event: IpcRendererEvent, state: LiveState): void => listener(state)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: LlpApi = {
  live: {
    get: () => ipcRenderer.invoke(Channels.liveGet),
    send: (command) => ipcRenderer.send(Channels.liveCommand, command),
    subscribe: (listener) => listen(Channels.liveChanged, listener),
  },
  window: {
    control: (action) => ipcRenderer.send(Channels.windowControl, action),
  },
}

contextBridge.exposeInMainWorld('llp', api)
