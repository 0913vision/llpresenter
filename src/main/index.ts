import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {isAnyOutputOn} from '@shared/live';
import {LiveStore, dispatchLogged} from './live/store';
import {createLogger, flushWithin, type Logger} from './log';
import {registerIpc} from './ipc';
import {startOutputs} from './outputs/start';
import {LOG_FLUSH_LIMIT_MS, ShutdownCoordinator} from './shutdown';
import {registerSoakRecorder, registerSoakScenario} from './soak';
import {registerStore} from './store/register';
import {registerUiState} from './uiState/register';
import {applyUserDataOverride, type UserDataProblem} from './userData';
import {createControlWindow} from './windows/control';
import {registerMediaScheme, serveMedia} from './windows/mediaProtocol';
import {windowModeFrom, type WindowMode} from './windows/testWindows';

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

function quitAfterSmokeTest(
  win: BrowserWindow,
  logger: Logger,
  mode: WindowMode,
): void {
  const delayMs = Number(process.env['LLP_SMOKE_EXIT_MS'] ?? '0');
  if (delayMs <= 0) return;
  const closeLater = (): void => {
    setTimeout(() => {
      logger.info('smoke ok');
      win.close();
    }, delayMs);
  };
  // NOTE(0913vision): An offscreen window never shows, so the smoke test
  // waits for it to be ready instead.
  if (mode === 'offscreen') win.once('ready-to-show', closeLater);
  else win.once('show', closeLater);
}

function bringBack(win: BrowserWindow | null, mode: WindowMode): void {
  // NOTE(0913vision): A second launch never shows an offscreen control
  // window.
  if (win === null || mode === 'offscreen') return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

function start(): void {
  let control: BrowserWindow | null = null;
  const windowMode = windowModeFrom(process.env, app.isPackaged);

  app.on('second-instance', () => bringBack(control, windowMode));
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
      const disposeIpc = registerIpc(store, log, windowMode);
      const stopServingMedia = serveMedia({
        resolvePath: dataStore.findMediaFile,
        mediaRoots: dataStore.mediaRoots,
        log,
      });
      const win = createControlWindow(log, windowMode);
      control = win;
      const outputs = startOutputs({store, control: win, log, windowMode});
      const stopSoakScenario = registerSoakScenario(log, command =>
        dispatchLogged(store, command, log),
      );
      const stopSoakRecorder = registerSoakRecorder(log, {
        frameRates: outputs.frameRates,
      });
      // NOTE(0913vision): The soak scenario stops first, so it changes
      // nothing while the outputs close. Output windows turn a close into
      // "output off", so they are destroyed before Electron closes windows to
      // quit.
      shutdown.add({name: 'stop the soak scenario', run: stopSoakScenario});
      shutdown.add({name: 'stop the outputs', run: outputs.stop});
      shutdown.add({name: 'save the UI state', run: () => ui.dispose()});
      shutdown.add({name: 'finish the soak record', run: stopSoakRecorder});
      shutdown.add({name: 'close the data store', run: dataStore.dispose});
      shutdown.add({name: 'stop serving media', run: stopServingMedia});
      shutdown.add({name: 'remove the IPC channels', run: disposeIpc});
      win.on('closed', () => {
        control = null;
        app.quit();
      });
      quitAfterSmokeTest(win, log, windowMode);
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
