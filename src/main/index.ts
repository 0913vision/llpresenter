import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {isAnyOutputOn} from '@shared/live';
import {LiveStore} from './live/store';
import {createLogger, flushWithin, type Logger} from './log';
import {registerIpc} from './ipc';
import {startOutputs} from './outputs/start';
import {LOG_FLUSH_LIMIT_MS, ShutdownCoordinator} from './shutdown';
import {registerSoakRecorder} from './soak';
import {registerStore} from './store/register';
import {registerUiState} from './uiState/register';
import {applyUserDataOverride, type UserDataProblem} from './userData';
import {createControlWindow} from './windows/control';
import {registerMediaScheme, serveMedia} from './windows/mediaProtocol';

const BAD_ENVIRONMENT_EXIT_CODE = 1;
const UI_STATE_FILE = 'app.json';

const userDataProblem = applyUserDataOverride(
  process.env['LLP_USER_DATA'],
  path => app.setPath('userData', path),
);

registerMediaScheme();

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
  const shutdown = new ShutdownCoordinator({app, log});

  app
    .whenReady()
    .then(async () => {
      const ui = await registerUiState(
        join(app.getPath('userData'), UI_STATE_FILE),
        log,
      );
      const store = new LiveStore();
      const dataStore = registerStore({
        log,
        isAnyOutputOn: () => isAnyOutputOn(store.state),
      });
      const disposeIpc = registerIpc(store, log);
      const stopServingMedia = serveMedia({
        resolvePath: dataStore.findMediaFile,
        mediaRoots: dataStore.mediaRoots,
        log,
      });
      const win = createControlWindow(log);
      control = win;
      const stopSoakRecorder = registerSoakRecorder(log);
      const stopOutputs = startOutputs({store, control: win, log});
      // NOTE(0913vision): Output windows turn a close into "output off", so
      // they are destroyed first, before Electron closes windows to quit.
      shutdown.add({name: 'stop the outputs', run: stopOutputs});
      shutdown.add({name: 'save the UI state', run: () => ui.dispose()});
      shutdown.add({name: 'finish the soak record', run: stopSoakRecorder});
      shutdown.add({name: 'close the data store', run: dataStore.dispose});
      shutdown.add({name: 'stop serving media', run: stopServingMedia});
      shutdown.add({name: 'remove the IPC channels', run: disposeIpc});
      win.on('closed', () => {
        control = null;
        app.quit();
      });
      quitAfterSmokeTest(win, log);
      log.info('started', {
        version: app.getVersion(),
        electron: process.versions.electron,
      });
    })
    .catch((error: unknown) => log.error('failed to start', error));
}

// NOTE(0913vision): With a bad LLP_USER_DATA, the app quits instead of using
// the default folder, which another session or the real app data may hold.
function quitForBadUserData(problem: UserDataProblem): void {
  log.error('LLP_USER_DATA is not a usable app data folder; quitting', problem);
  const exit = (): void => app.exit(BAD_ENVIRONMENT_EXIT_CODE);
  flushWithin(log, LOG_FLUSH_LIMIT_MS).then(exit, exit);
}

if (userDataProblem !== null) quitForBadUserData(userDataProblem);
else if (app.requestSingleInstanceLock()) start();
else app.quit();
