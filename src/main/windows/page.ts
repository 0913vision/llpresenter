import type {BrowserWindow} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../log';

/** The renderer pages: the control window's and the output windows'. */
export type PageName = 'index' | 'output';

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

/** Loads a page from the dev server, or from the build when there is none. A failed load is logged. */
export function loadPage(
  win: BrowserWindow,
  {name, query = {}}: PageRequest,
  log: Logger,
): void {
  const devServer = process.env['ELECTRON_RENDERER_URL'];
  const loading =
    devServer !== undefined && devServer.length > 0
      ? win.loadURL(`${devServer}/${name}.html${searchOf(query)}`)
      : win.loadFile(join(__dirname, `../renderer/${name}.html`), {query});
  loading.catch((error: unknown) => log.error(`failed to load ${name}`, error));
}

/** Keeps the window on its own page: no navigation and no new windows. */
export function blockNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
}
