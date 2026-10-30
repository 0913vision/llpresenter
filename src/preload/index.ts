import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {Channels, llpApi} from '@contracts/ipc/api';
import {badValueLog, createIpcPort} from './port';
import {windowPlatform} from './platform';

const log = badValueLog(ipcRenderer, Channels.logWrite);

contextBridge.exposeInMainWorld(
  'llp',
  llpApi(
    createIpcPort(ipcRenderer, log),
    windowPlatform({webFrame, webUtils}, log),
  ),
);
