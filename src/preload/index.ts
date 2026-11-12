import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {llpApi} from '@contracts/ipc/api';
import {outputEndpoints} from '@contracts/ipc/output';
import {badValueLog, createIpcPort} from './port';
import {windowPlatform} from './platform';
import {slidesEditorPreload} from './slidesEditor';
import {biblePreload} from './bible';
import {updatePreload} from './update';

const log = badValueLog(ipcRenderer, outputEndpoints.log.channel);
const port = createIpcPort(ipcRenderer, log);

contextBridge.exposeInMainWorld(
  'llp',
  llpApi(port, windowPlatform({webFrame, webUtils}, log), {
    slidesEditor: slidesEditorPreload(port),
    bible: biblePreload(port),
    update: updatePreload(port),
  }),
);

contextBridge.exposeInMainWorld('draftSheet', () =>
  ipcRenderer.invoke('draft-sheet:read'),
);
