import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {llpApi} from '@contracts/ipc/api';
import {outputEndpoints} from '@contracts/ipc/output';
import {badValueLog, createIpcPort} from './port';
import {windowPlatform} from './platform';

const log = badValueLog(ipcRenderer, outputEndpoints.log.channel);

contextBridge.exposeInMainWorld(
  'llp',
  llpApi(
    createIpcPort(ipcRenderer, log),
    windowPlatform({webFrame, webUtils}, log),
  ),
);
