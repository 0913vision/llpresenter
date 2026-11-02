import type {BrowserWindow} from 'electron';
import type {Logger} from '../log';
import {RestartBudget} from '../outputs/restartBudget';
import {loadPage, type PageRequest} from './page';

/**
 * Loads a window's page again when its renderer process dies, so the window
 * comes back with the state main already holds. A clean exit is left alone. A
 * window that dies again and again (the output windows' restart limit: 3 in 60
 * seconds) is not loaded any more, so a crash loop cannot spin; the log says so.
 */
export function reloadAfterCrash({
  win,
  page,
  label,
  log,
}: {
  readonly win: BrowserWindow;
  readonly page: PageRequest;
  /** What the log calls the window, such as control or preferences. */
  readonly label: string;
  readonly log: Logger;
}): void {
  const budget = new RestartBudget();
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error(`${label} window process gone`, details);
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;
    if (!budget.recordCrash()) {
      log.error(
        `${label} window keeps crashing; not loading it again`,
        details,
      );
      return;
    }
    loadPage(win, page, log);
  });
}
