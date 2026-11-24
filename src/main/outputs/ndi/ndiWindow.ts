import {NDI_DEFAULT_FPS} from '@core/schema/screens/screens';
import {BrowserWindow, type UtilityProcess} from 'electron';
import type {Logger} from '../../base/log';
import {blockNavigation, preloadPath, startLoading} from '../../base/page';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents} from '../outputWindow';
import {NDI_FRAME_HEIGHT, NDI_FRAME_WIDTH} from './textureQueue';

/**
 * The hidden window an NDI output draws in: one NDI frame large, without a
 * frame, transparent, painting at 60 or 30 frames by the screen's rate, with
 * the output page loading. `sharedTexture` paints to the GPU texture the GPU
 * sender reads; otherwise it paints bitmaps. `reload` loads the page again.
 */
export function createNdiWindow(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {
    sharedTexture,
    onLoadError,
  }: {
    readonly sharedTexture: boolean;
    readonly onLoadError: (error: unknown) => void;
  },
): {readonly win: BrowserWindow; readonly reload: () => Promise<void>} {
  const win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    width: NDI_FRAME_WIDTH,
    height: NDI_FRAME_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: sharedTexture ? {useSharedTexture: true} : true,
    },
  });
  if (sharedTexture) win.webContents.stopPainting();
  win.setMinimumSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.setContentSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.webContents.setFrameRate(
    (screen.ndi?.fps ?? NDI_DEFAULT_FPS) > 30 ? 60 : 30,
  );
  const page = {name: 'output' as const, query: {screen: screen.id, ndi: '1'}};
  blockNavigation(win);
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) =>
    events.onRendererGone(details),
  );
  void startLoading(win, page).catch(onLoadError);
  return {win, reload: () => startLoading(win, page)};
}

/**
 * Asks a sender process to stop, or ends it at once when `now`; one that has
 * not exited after `timeoutMs` is ended. `exited` runs once it is gone.
 */
export function stopSender(
  sender: UtilityProcess,
  {
    timeoutMs,
    now = false,
    log,
    exited,
  }: {
    readonly timeoutMs: number;
    readonly now?: boolean;
    readonly log?: Logger;
    readonly exited?: () => void;
  },
): void {
  const killTimer = setTimeout(() => sender.kill(), timeoutMs);
  killTimer.unref();
  sender.once('exit', () => {
    clearTimeout(killTimer);
    exited?.();
  });
  if (now) {
    sender.kill();
    return;
  }
  try {
    sender.postMessage({type: 'stop'});
  } catch (error) {
    log?.warn('NDI sender already stopped', error);
    clearTimeout(killTimer);
    sender.kill();
  }
}
