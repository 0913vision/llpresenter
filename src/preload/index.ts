import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron';
import {Channels, type LlpApi, type Unsubscribe} from '@shared/ipc';
import type {LiveState} from '@shared/live';

function listen(
  channel: string,
  listener: (state: LiveState) => void,
): Unsubscribe {
  const handler = (_event: IpcRendererEvent, state: LiveState): void =>
    listener(state);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: LlpApi = {
  live: {
    get: () => ipcRenderer.invoke(Channels.liveGet),
    send: command => ipcRenderer.send(Channels.liveCommand, command),
    subscribe: listener => listen(Channels.liveChanged, listener),
  },
  window: {
    control: action => ipcRenderer.send(Channels.windowControl, action),
  },
  ui: {
    get: () => ipcRenderer.invoke(Channels.uiGet),
    setLayout: change => ipcRenderer.send(Channels.uiLayoutSet, change),
  },
  log: {
    write: entry => ipcRenderer.send(Channels.logWrite, entry),
  },
  output: {
    reportFrameRate: report =>
      ipcRenderer.send(Channels.outputFrameRate, report),
  },
};

contextBridge.exposeInMainWorld('llp', api);
