import {ipcMain} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import type {OpenWindowResult} from '@core/schema/ipcPayloads';
import type {Logger} from '../log';

const NOT_IMPLEMENTED: OpenWindowResult = {
  ok: false,
  error: {reason: 'not-implemented'},
};

interface SongEditorWindowOptions {
  readonly log: Logger;
}

export interface SongEditorWindowRegistration {
  readonly dispose: () => void;
}

// TODO(0913vision): prep-219 replaces this stub with the real window.
/** Answers the open call and the target query until the window exists. */
export function registerSongEditorWindow({
  log,
}: SongEditorWindowOptions): SongEditorWindowRegistration {
  const openChannel = windowEndpoints.openSongEditor.channel;
  const targetChannel = songEditorWindowEndpoints.target.channel;
  ipcMain.handle(openChannel, () => NOT_IMPLEMENTED);
  ipcMain.handle(targetChannel, () => null);
  log.info('song editor window is not implemented yet');
  return {
    dispose: () => {
      ipcMain.removeHandler(openChannel);
      ipcMain.removeHandler(targetChannel);
    },
  };
}
