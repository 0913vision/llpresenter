import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {llpApi} from '@contracts/ipc/api';
import {outputEndpoints} from '@contracts/ipc/output';
import {badValueLog, createIpcPort} from './port';
import {windowPlatform} from './platform';
import {slidesEditorPreload} from './slidesEditor';

const log = badValueLog(ipcRenderer, outputEndpoints.log.channel);
const port = createIpcPort(ipcRenderer, log);

contextBridge.exposeInMainWorld(
  'llp',
  llpApi(
    port,
    windowPlatform({webFrame, webUtils}, log),
    slidesEditorPreload(port),
  ),
);
