import type {BrowserWindow} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../log';

/** The renderer pages: the control window's, the output windows', and media analysis. */
export type PageName = 'index' | 'output' | 'analysis';

/** A renderer page and the query string values it reads. */
export interface PageRequest {
  readonly name: PageName;
  readonly query?: Readonly<Record<string, string>>;
}

export const preloadPath = join(__dirname, '../preload/index.js');

function searchOf(query: Readonly<Record<string, string>>): string {
  const search = new URLSearchParams(query).toString();
  return search.length > 0 ? `?${search}` : '';
}

/**
 * Loads a page from the dev server, or from the build when there is none.
 *
 * @returns A promise that rejects when the page fails to load.
 */
export function startLoading(
  win: BrowserWindow,
  {name, query = {}}: PageRequest,
): Promise<void> {
  const devServer = process.env['ELECTRON_RENDERER_URL'];
  return devServer !== undefined && devServer.length > 0
    ? win.loadURL(`${devServer}/${name}.html${searchOf(query)}`)
    : win.loadFile(join(__dirname, `../renderer/${name}.html`), {query});
}

/** Like {@link startLoading}, but a failed load is logged. */
export function loadPage(
  win: BrowserWindow,
  page: PageRequest,
  log: Logger,
): void {
  startLoading(win, page).catch((error: unknown) =>
    log.error(`failed to load ${page.name}`, error),
  );
}

/** Keeps the window on its own page: no navigation and no new windows. */
export function blockNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
}
