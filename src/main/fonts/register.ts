import {app, BrowserWindow, type WebContents} from 'electron';
import {join} from 'node:path';
import {outputEndpoints} from '@contracts/ipc/output';
import {IpcHost, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {FontCatalogCache} from './fontCatalog';
import {readCatalogFile, writeCatalogFile} from './catalogFile';
import {readWindowsFontStamp} from './windowsFontStamp';
import {readWindowsFonts} from './windowsFonts';
import {contentsForLog} from '../base/renderers/pageUrl';

interface FontReader {
  readonly mainFrame: object;
  getURL(): string;
}

/**
 * Whether a page is one of the app's own that draws with the fonts: the
 * output page, or 화면 설정 or 환경설정 of the control page.
 */
function isAppRenderPage(sender: WebContents, control: FontReader): boolean {
  try {
    const controlPage = new URL(control.getURL());
    const expected = new URL('output.html', controlPage);
    const actual = new URL(sender.getURL());
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.origin === expected.origin &&
      (actual.pathname === expected.pathname ||
        (actual.pathname === controlPage.pathname &&
          ['screens', 'settings'].includes(
            actual.searchParams.get('window') ?? '',
          )))
    );
  } catch {
    return false;
  }
}

/** Exposes cached font metadata to control and trusted rendering main frames. */
export function registerFonts(
  control: {readonly webContents: FontReader},
  log: Logger,
  ready?: Promise<boolean>,
): () => void {
  const ipc = new IpcHost(log);
  const file = join(app.getPath('userData'), 'font-catalog.json');
  const catalog = new FontCatalogCache({
    ...(ready === undefined ? {} : {ready}),
    read: readWindowsFonts,
    log,
    stamp: readWindowsFontStamp,
    load: () => readCatalogFile(file),
    save: value => writeCatalogFile(file, value),
    changed: value => ipc.push(outputEndpoints.fontsChanged, value),
  });
  const check = ({contents, isMainFrame}: Caller): void => {
    if (isMainFrame && contents === control.webContents) return;
    const appPage =
      isMainFrame && isAppRenderPage(contents, control.webContents);
    if (appPage && BrowserWindow.fromWebContents(contents) !== null) return;
    if (appPage) {
      // NOTE(0913vision): The page of a window that was just closed can still
      // ask while it goes: the 청중 output window does when its presenter
      // comes back with the monitor (church Nov 23 and 26). It needs no
      // answer.
      log.info(
        'Dropped a font catalog request of a closed window',
        contentsForLog(contents),
      );
      throw new Error('Font catalog request of a closed window');
    }
    log.warn('Refused an invalid font catalog request', {
      ...contentsForLog(contents),
      isMainFrame,
    });
    throw new Error('Invalid font catalog request');
  };
  ipc.query(outputEndpoints.fonts, caller => {
    check(caller);
    return catalog.get();
  });
  ipc.query(outputEndpoints.fontSnapshot, caller => {
    check(caller);
    return catalog.snapshot();
  });
  return () => {
    ipc.close();
    catalog.dispose();
  };
}
