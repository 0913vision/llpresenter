import {app, BrowserWindow, type WebContents} from 'electron';
import {join} from 'node:path';
import {outputEndpoints} from '@contracts/ipc/output';
import {IpcHost, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {FontCatalogCache} from './fontCatalog';
import {readCatalogFile, writeCatalogFile} from './catalogFile';
import {readWindowsFontStamp} from './windowsFontStamp';
import {readWindowsFonts} from './windowsFonts';

interface FontReader {
  readonly mainFrame: object;
  getURL(): string;
}

function isRenderReader(sender: WebContents, control: FontReader): boolean {
  if (BrowserWindow.fromWebContents(sender) === null) return false;
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
    if (
      isMainFrame &&
      (contents === control.webContents ||
        isRenderReader(contents, control.webContents))
    ) {
      return;
    }
    log.warn('Refused an invalid font catalog request');
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
