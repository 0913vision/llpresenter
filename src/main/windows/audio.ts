import {app, BrowserWindow} from 'electron';
import type {Logger} from '../log';
import type {MediaStore} from '../store/mediaStore';
import {connectMediaPlayback} from '../live/mediaPlayback';
import {RendererRecovery} from '../outputs/rendererRecovery';
import {audioMutedByDefault} from './audioPolicy';
import {
  blockNavigation,
  loadPage,
  startLoading,
  preloadPath,
  type PageRequest,
} from './page';
import type {WindowMode} from './testWindows';
import {
  watchPlaybackProblems,
  type PlaybackProblemBoard,
} from '../outputs/playbackProblems';

interface AudioOutputOptions {
  readonly playbackProblems?: Pick<
    PlaybackProblemBoard,
    'register' | 'renderer'
  >;
  readonly store: Parameters<typeof connectMediaPlayback>[0];
  readonly media: Promise<Pick<MediaStore, 'get' | 'subscribe'> | null>;
  readonly log: Logger;
  readonly windowMode: WindowMode;
}

/** Owns the hidden audio renderer independently of the control and screen windows. */
export function registerAudioOutput({
  playbackProblems,
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
    const contents = opened.webContents;
    contents.setAudioMuted(muted);
    blockNavigation(opened);
    const page: PageRequest = {
      name: 'output',
      query: {audio: muted ? 'muted' : 'sound'},
    };
    const recovery = new RendererRecovery({
      screenId: 'audio',
      log,
      onStateChange: state => playbackProblems?.renderer(contents.id, state),
      reload: async () => {
        await startLoading(opened, page);
      },
    });
    const releaseProblems =
      playbackProblems === undefined
        ? undefined
        : watchPlaybackProblems(playbackProblems, contents, {
            source: 'audio',
            name: () => '오디오',
            retry: () => {
              if (recovery.state === 'limited') recovery.retry();
              else if (recovery.state === 'running') contents.reload();
            },
          });
    const crashed = (
      _event: unknown,
      details: {reason: string; exitCode: number},
    ): void => {
      if (stopped || opened.isDestroyed()) return;
      attempt(() => recovery.crashed(details));
    };
    const ready = (): void => attempt(() => recovery.pageDrawn());
    releaseCrash = () => {
      releaseProblems?.();
      recovery.dispose();
      if (opened.isDestroyed() || contents.isDestroyed()) return;
      attempt(() => contents.removeListener('render-process-gone', crashed));
      attempt(() => contents.removeListener('did-finish-load', ready));
    };
    contents.on('render-process-gone', crashed);
    contents.on('did-finish-load', ready);
    loadPage(opened, page, log);
  });
  void media
    .then(reader => {
      if (stopped) return;
      if (reader === null) throw new Error('Audio media is unavailable');
      releaseMedia = connectMediaPlayback(store, reader, log);
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
