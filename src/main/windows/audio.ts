import {app, BrowserWindow} from 'electron';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import type {MediaStore} from '../store/mediaStore';
import {RestartBudget} from '../outputs/restartBudget';
import {audioMutedByDefault} from './audioPolicy';
import {blockNavigation, loadPage, preloadPath, type PageRequest} from './page';
import type {WindowMode} from './testWindows';

interface AudioOutputOptions {
  readonly store: LiveStore;
  readonly media: Promise<Pick<MediaStore, 'get'> | null>;
  readonly log: Logger;
  readonly windowMode: WindowMode;
}

/** Owns the hidden audio renderer independently of the control and screen windows. */
export function registerAudioOutput({
  store,
  media,
  log,
  windowMode,
}: AudioOutputOptions): () => void {
  let stopped = false;
  let releaseMedia: (() => void) | undefined;
  let releaseCrash: (() => void) | undefined;
  let win: BrowserWindow | null = null;
  const attempt = (run: () => void): void => {
    try {
      run();
    } catch (error) {
      log.error('audio output failed', error);
    }
  };
  attempt(() => {
    const muted =
      windowMode === 'offscreen' ||
      audioMutedByDefault(process.env, app.isPackaged);
    const opened = new BrowserWindow({
      show: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });
    win = opened;
    opened.webContents.setAudioMuted(muted);
    blockNavigation(opened);
    const page: PageRequest = {
      name: 'output',
      query: {audio: muted ? 'muted' : 'sound'},
    };
    const budget = new RestartBudget();
    const crashed = (): void => {
      if (stopped || opened.isDestroyed()) return;
      log.error('audio renderer process gone');
      if (budget.recordCrash()) attempt(() => loadPage(opened, page, log));
    };
    opened.webContents.on('render-process-gone', crashed);
    releaseCrash = () =>
      opened.webContents.removeListener('render-process-gone', crashed);
    loadPage(opened, page, log);
  });
  void media
    .then(reader => {
      if (stopped) return;
      if (reader === null) throw new Error('Audio media is unavailable');
      releaseMedia = store.connectAudioMedia(() => reader.get().value);
    })
    .catch((error: unknown) =>
      log.error('could not connect audio media', error),
    );
  return () => {
    if (stopped) return;
    stopped = true;
    attempt(() => releaseMedia?.());
    attempt(() => releaseCrash?.());
    const opened = win;
    attempt(() => {
      if (opened !== null && !opened.isDestroyed()) opened.destroy();
    });
  };
}
