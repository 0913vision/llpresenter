import {BrowserWindow, ipcMain, type WebContents} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import type {Logger} from '../log';
import {FontCatalogCache} from './fontCatalog';
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
          actual.searchParams.get('window') === 'screens'))
    );
  } catch {
    return false;
  }
}

/** Exposes cached font metadata to control and trusted rendering main frames. */
export function registerFonts(
  control: {readonly webContents: FontReader},
  log: Logger,
): () => void {
  const catalog = new FontCatalogCache({read: readWindowsFonts, log});
  ipcMain.handle(outputEndpoints.fonts.channel, (event, ...args: unknown[]) => {
    if (
      args.length !== 0 ||
      event.senderFrame !== event.sender.mainFrame ||
      (event.sender !== control.webContents &&
        !isRenderReader(event.sender, control.webContents))
    ) {
      log.warn('Refused an invalid font catalog request');
      throw new Error('Invalid font catalog request');
    }
    return catalog.get();
  });
  return () => {
    ipcMain.removeHandler(outputEndpoints.fonts.channel);
    catalog.dispose();
  };
}
