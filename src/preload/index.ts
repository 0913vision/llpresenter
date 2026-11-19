import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {llpApi} from '@contracts/ipc/api';
import {outputEndpoints} from '@contracts/ipc/output';
import {badValueLog, createIpcPort} from './port';
import {windowPlatform} from './platform';
import {slidesEditorPreload} from './slidesEditor';
import {biblePreload} from './bible';
import {updatePreload} from './update';
import {picturePreload} from './picture';

const log = badValueLog(ipcRenderer, outputEndpoints.log.channel);
const port = createIpcPort(ipcRenderer, log);

if (
  typeof process !== 'undefined' &&
  process.env['LLP_TEST_WINDOWS'] === 'offscreen' &&
  process.env['LLP_TEST_GPU_CRASH'] === '1'
) {
  contextBridge.exposeInMainWorld(
    'llpTestGpuFailure',
    (kind: 'crash' | 'hang') => {
      ipcRenderer.send('test:gpu-failure', kind);
    },
  );
}

contextBridge.exposeInMainWorld(
  'llp',
  llpApi(port, windowPlatform({webFrame, webUtils}, log), {
    slidesEditor: slidesEditorPreload(port),
    bible: biblePreload(port),
    update: updatePreload(port),
    picture: picturePreload(port, ipcRenderer),
  }),
);
