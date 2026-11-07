import {ipcMain, type BrowserWindow} from 'electron';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {windowEndpoints} from '@contracts/ipc/window';
import type {
  OpenWindowResult,
  SongEditorTarget,
} from '@core/schema/ipcPayloads';
import type {AppConfigFile} from '../store/appConfigFile';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import type {WindowMode} from './testWindows';

interface SongEditorWindowOptions {
  readonly control: BrowserWindow;
  readonly config: Pick<
    AppConfigFile,
    'songEditorWindow' | 'setSongEditorWindow'
  >;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
  readonly hasSong: (songId: string) => Promise<boolean>;
}
export interface SongEditorWindowRegistration {
  readonly close: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

/** Existing editor requests now target the control workspace. */
export function registerSongEditorWindow(
  options: SongEditorWindowOptions,
): SongEditorWindowRegistration {
  let target: SongEditorTarget | null = null;
  let disposed = false;
  const unavailable = (): boolean => disposed || options.control.isDestroyed();
  const open = async (
    requested: SongEditorTarget,
  ): Promise<OpenWindowResult> => {
    if (unavailable()) {
      return {ok: false, error: {reason: 'failed'}};
    }
    if (
      requested.from === undefined &&
      !(await options.hasSong(requested.songId))
    ) {
      return {ok: false, error: {reason: 'no-such-target'}};
    }
    if (unavailable()) {
      return {ok: false, error: {reason: 'failed'}};
    }
    target = requested;
    options.control.webContents.send(
      songEditorWindowEndpoints.retarget.channel,
      target,
    );
    return {ok: true, value: undefined};
  };
  const openChannel = windowEndpoints.openSongEditor.channel;
  const targetChannel = songEditorWindowEndpoints.target.channel;
  ipcMain.handle(openChannel, (_event, value: unknown) => {
    const parsed = windowEndpoints.openSongEditor.request(value);
    return parsed.ok
      ? open(parsed.value)
      : windowEndpoints.openSongEditor.refuse?.(parsed.error);
  });
  ipcMain.handle(targetChannel, () => target);
  return {
    close: () => Promise.resolve(true),
    dispose: () => {
      disposed = true;
      ipcMain.removeHandler(openChannel);
      ipcMain.removeHandler(targetChannel);
      return Promise.resolve();
    },
  };
}
