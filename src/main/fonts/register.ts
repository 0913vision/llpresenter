import {app, BrowserWindow, ipcMain, type WebContents} from 'electron';
import {join} from 'node:path';
import {outputEndpoints} from '@contracts/ipc/output';
import type {Logger} from '../log';
import {FontCatalogCache} from './fontCatalog';
import {readCatalogFile, writeCatalogFile} from './catalogFile';
import {readWindowsFontStamp} from './windowsFontStamp';
import {sendToWindows} from '../ipc';
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
  const file = join(app.getPath('userData'), 'font-catalog.json');
  const catalog = new FontCatalogCache({
    ...(ready === undefined ? {} : {ready}),
    read: readWindowsFonts,
    log,
    stamp: readWindowsFontStamp,
    load: () => readCatalogFile(file),
    save: value => writeCatalogFile(file, value),
    changed: value =>
      sendToWindows(outputEndpoints.fontsChanged.channel, value, log),
  });
  for (const [channel, read] of [
    [outputEndpoints.fonts.channel, () => catalog.get()],
    [outputEndpoints.fontSnapshot.channel, () => catalog.snapshot()],
  ] as const) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (
        args.length !== 0 ||
        event.senderFrame !== event.sender.mainFrame ||
        (event.sender !== control.webContents &&
          !isRenderReader(event.sender, control.webContents))
      ) {
        log.warn('Refused an invalid font catalog request');
        throw new Error('Invalid font catalog request');
      }
      return read();
    });
  }
  return () => {
    ipcMain.removeHandler(outputEndpoints.fonts.channel);
    ipcMain.removeHandler(outputEndpoints.fontSnapshot.channel);
    catalog.dispose();
  };
}
