import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {LiveStore} from './live/store';
import {createLogger, type Logger} from './log';
import {registerIpc} from './ipc';
import {createControlWindow} from './windows/control';

// NOTE(0913vision): Several sessions run the app at once during development,
// so LLP_USER_DATA moves the app data folder and, with it, the single-instance
// lock.
const userData = process.env['LLP_USER_DATA'];
if (userData !== undefined && userData.length > 0) {
  app.setPath('userData', userData);
}

const log = createLogger(join(app.getPath('userData'), 'logs'), {
  echo: !app.isPackaged,
});

// NOTE(0913vision): Unhandled errors are logged instead of opening Electron's
// error dialog, which must never appear during a service.
process.on('uncaughtException', error =>
  log.error('uncaught exception', error),
);
process.on('unhandledRejection', reason =>
  log.error('unhandled rejection', reason),
);

function quitAfterSmokeTest(win: BrowserWindow, logger: Logger): void {
  const delayMs = Number(process.env['LLP_SMOKE_EXIT_MS'] ?? '0');
  if (delayMs <= 0) return;
  win.once('show', () => {
    setTimeout(() => {
      logger.info('smoke ok');
      win.close();
    }, delayMs);
  });
}

function start(): void {
  let control: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (control === null) return;
    if (control.isMinimized()) control.restore();
    control.focus();
  });
  app.on('child-process-gone', (_event, details) =>
    log.error('child process gone', details),
  );
  app.on('window-all-closed', () => app.quit());

  app
    .whenReady()
    .then(() => {
      const store = new LiveStore();
      const disposeIpc = registerIpc(store, log);
      const win = createControlWindow(log);
      control = win;
      win.on('closed', () => {
        control = null;
        disposeIpc();
        void log.flush().finally(() => app.quit());
      });
      quitAfterSmokeTest(win, log);
      log.info('started', {
        version: app.getVersion(),
        electron: process.versions.electron,
      });
    })
    .catch((error: unknown) => log.error('failed to start', error));
}

if (app.requestSingleInstanceLock()) start();
else app.quit();
