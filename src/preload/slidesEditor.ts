import {slidesEditorApi} from '@contracts/ipc/slidesEditor';
import type {IpcPort} from '@contracts/ipc/endpoint';

/** Builds the isolated slides editor bridge with the validated IPC port. */
export function slidesEditorPreload(port: IpcPort) {
  return slidesEditorApi(port);
}
