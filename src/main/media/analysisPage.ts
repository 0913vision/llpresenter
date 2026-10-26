import {BrowserWindow} from 'electron';
import type {Logger} from '../log';
import {blockNavigation, startLoading} from '../windows/page';
import type {AnalysisPage} from './mediaAnalyser';

/**
 * Opens the analysis page in a window that is never shown or focused,
 * sandboxed and without a preload (`docs/decisions.md`, "Media analysis runs
 * in a hidden renderer"). Main calls the page's `analyseMedia` with
 * `executeJavaScript`.
 *
 * @returns The page once it has loaded; rejects, with the window closed, when
 * it can't load.
 */
export async function openAnalysisPage(log: Logger): Promise<AnalysisPage> {
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
  blockNavigation(win);
  win.webContents.on('render-process-gone', (_event, details) => {
    log.warn('the media analysis page stopped', details);
  });
  try {
    await startLoading(win, {name: 'analysis'});
  } catch (error: unknown) {
    win.destroy();
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
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
