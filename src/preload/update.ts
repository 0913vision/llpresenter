import {updateApi} from '@contracts/ipc/update';
import type {IpcPort} from '@contracts/ipc/endpoint';

export function updatePreload(port: IpcPort) {
  return updateApi(port);
}
