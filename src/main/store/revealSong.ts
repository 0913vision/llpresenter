import {ipcMain, shell, type IpcMainEvent} from 'electron';
import {libraryEndpoints} from '@contracts/ipc/library';
import {parseShowLibrarySongRequest} from '@core/schema/showLibrarySong';
import type {WindowMode} from '../windows/testWindows';
import type {Logger} from '../log';

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
  const reveal = (_event: IpcMainEvent, value: unknown): void => {
    const parsed = parseShowLibrarySongRequest(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed song reveal', parsed.error);
      return;
    }
    if (windowMode === 'offscreen') {
      log.info('song file reveal is unavailable in offscreen mode');
      return;
    }
    fileOf(parsed.value.songId)
      .then(file => {
        if (file === undefined) {
          log.info('no song file to reveal', {songId: parsed.value.songId});
          return;
        }
        shell.showItemInFolder(file);
      })
      .catch((error: unknown) => {
        log.error('could not reveal a song file', error);
      });
  };
  ipcMain.on(libraryEndpoints.revealSong.channel, reveal);
  return () => {
    ipcMain.removeListener(libraryEndpoints.revealSong.channel, reveal);
  };
}
