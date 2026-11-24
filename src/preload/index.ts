import {contextBridge, ipcRenderer, webFrame, webUtils} from 'electron';
import {llpApi} from '@contracts/ipc/api';
import {outputEndpoints} from '@contracts/ipc/output';
import {badValueLog, createIpcPort} from './port';
import {bibleApi} from '@contracts/ipc/bible';
import {updateApi} from '@contracts/ipc/update';
import {windowPlatform} from './platform';

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
    bible: bibleApi(port),
    update: updateApi(port),
  }),
);
