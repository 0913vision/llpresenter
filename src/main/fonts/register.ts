import {ipcMain} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import type {Logger} from '../log';
import {FontCatalogCache} from './fontCatalog';
import {readWindowsFonts} from './windowsFonts';

/** Exposes native font metadata only to the control window's main frame. */
export function registerFonts(
  control: {readonly webContents: {readonly mainFrame: object}},
  log: Logger,
): () => void {
  const catalog = new FontCatalogCache({read: readWindowsFonts, log});
  ipcMain.handle(outputEndpoints.fonts.channel, (event, ...args: unknown[]) => {
    if (
      event.sender !== control.webContents ||
      event.senderFrame !== control.webContents.mainFrame ||
      args.length !== 0
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
