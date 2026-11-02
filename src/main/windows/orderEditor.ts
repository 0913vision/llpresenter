import {ipcMain} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import {orderEditorEndpoints} from '@contracts/ipc/orderEditor';
import type {OpenWindowResult} from '@core/schema/ipcPayloads';
import type {Logger} from '../log';

const NOT_IMPLEMENTED: OpenWindowResult = {
  ok: false,
  error: {reason: 'not-implemented'},
};

interface OrderEditorWindowOptions {
  readonly log: Logger;
}

export interface OrderEditorWindowRegistration {
  readonly dispose: () => void;
}

// TODO(0913vision): items-206 replaces this stub with the real window.
/** Answers the open call and the target query until the window exists. */
export function registerOrderEditorWindow({
  log,
}: OrderEditorWindowOptions): OrderEditorWindowRegistration {
  const openChannel = windowEndpoints.openOrderEditor.channel;
  const targetChannel = orderEditorEndpoints.target.channel;
  ipcMain.handle(openChannel, () => NOT_IMPLEMENTED);
  ipcMain.handle(targetChannel, () => null);
  log.info('order editor window is not implemented yet');
  return {
    dispose: () => {
      ipcMain.removeHandler(openChannel);
      ipcMain.removeHandler(targetChannel);
    },
  };
}
