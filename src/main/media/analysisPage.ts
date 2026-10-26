import {BrowserWindow} from 'electron';
import type {Logger} from '../log';
import {blockNavigation, startLoading} from '../windows/page';
import type {AnalysisPage} from './mediaAnalyser';

function load(win: BrowserWindow, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = (): void => {
      reject(new Error('The analysis page was closed while it loaded'));
    };
    signal.addEventListener('abort', stop, {once: true});
    startLoading(win, {name: 'analysis'}).then(
      () => {
        signal.removeEventListener('abort', stop);
        resolve();
      },
      (error: unknown) => {
        signal.removeEventListener('abort', stop);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Opens the analysis page in a window that is never shown or focused,
 * sandboxed and without a preload (`docs/decisions.md`, "Media analysis runs
 * in a hidden renderer"). Main calls the page's `analyseMedia` with
 * `executeJavaScript`. The signal destroys the window at any time, also while
 * the page loads, which the analyser's deadline bounds.
 *
 * @returns The page once it has loaded; rejects, with the window closed, when
 * it can't load or the signal aborts first.
 */
export async function openAnalysisPage(
  log: Logger,
  signal: AbortSignal,
): Promise<AnalysisPage> {
  const win = new BrowserWindow({
    show: false,
    focusable: false,
    skipTaskbar: true,
    width: 320,
    height: 180,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  const destroy = (): void => {
    if (!win.isDestroyed()) win.destroy();
  };
  signal.addEventListener('abort', destroy, {once: true});
  blockNavigation(win);
  win.webContents.on('render-process-gone', (_event, details) => {
    log.warn('the media analysis page stopped', details);
  });
  try {
    if (signal.aborted) throw new Error('The analysis page was closed');
    await load(win, signal);
  } catch (error: unknown) {
    signal.removeEventListener('abort', destroy);
    destroy();
    throw error;
  }
  return {
    run: async job => {
      const reply: unknown = await win.webContents.executeJavaScript(
        `window.analyseMedia(${JSON.stringify(job)})`,
      );
      return reply;
    },
    close: () => {
      signal.removeEventListener('abort', destroy);
      destroy();
    },
  };
}
