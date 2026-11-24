import {shell} from 'electron';
import {libraryEndpoints} from '@contracts/ipc/library';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import type {WindowMode} from '../../base/renderers/testWindows';

/**
 * Shows a 라이브러리 song's file in the file manager when a window asks by id.
 * A window names only a song id. Main finds the song's file among the songs it
 * loaded, so 탐색기에서 보기 can't open any other path. An offscreen check
 * never opens it.
 *
 * @returns A function that stops listening.
 */
export function registerSongReveal({
  fileOf,
  windowMode,
  log,
}: {
  /** The file of a loaded song, or `undefined` when main has none. */
  readonly fileOf: (songId: string) => Promise<string | undefined>;
  readonly windowMode: WindowMode;
  readonly log: Logger;
}): () => void {
  const ipc = new IpcHost(log);
  ipc.message(libraryEndpoints.revealSong, ({songId}) => {
    if (windowMode === 'offscreen') {
      log.info('song file reveal is unavailable in offscreen mode');
      return;
    }
    fileOf(songId)
      .then(file => {
        if (file === undefined) {
          log.info('no song file to reveal', {songId});
          return;
        }
        shell.showItemInFolder(file);
      })
      .catch((error: unknown) => {
        log.error('could not reveal a song file', error);
      });
  });
  return () => {
    ipc.close();
  };
}
