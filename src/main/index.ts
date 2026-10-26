import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {isAnyOutputOn} from '@shared/live';
import {registerBible} from './bible/register';
import {registerTextImport} from './import/register';
import {startMediaAnalysis} from './media/analysis';
import {registerMediaBackend} from './media/register';
import {LiveStore, dispatchLogged} from './live/store';
import {startOverlays} from './live/overlays';
import {registerMacros} from './macros/register';
import {registerRecoveryChannels} from './live/recovery/channels';
import {RecoveryController, recoverySources} from './live/recovery/controller';
import {
  openServiceIdOf,
  RecoveryRecordWriter,
} from './live/recovery/recordWriter';
import {
  openRecoverySession,
  RECOVERY_RECORD_FILE,
} from './live/recovery/session';
import {registerLookSelection} from './live/lookSelection';
import {createLogger, flushWithin, type Logger} from './log';
import {registerIpc} from './ipc';
import {showOutputsOnLaunch} from './outputs/launch';
import {registerProblemFeed} from './problemFeed';
import {startOutputs} from './outputs/start';
import {LOG_FLUSH_LIMIT_MS, ShutdownCoordinator} from './shutdown';
import {registerSoakRecorder, registerSoakScenario} from './soak';
import {openAppConfig} from './store/appConfigFile';
import {registerStore} from './store/register';
import {registerUiZoom} from './store/uiZoom';
import {registerUiState} from './uiState/register';
import {applyUserDataOverride, type UserDataProblem} from './userData';
import {createControlWindow} from './windows/control';
import {registerAudioOutput} from './windows/audio';
import {registerControlClose} from './windows/controlClose';
import {registerMediaScheme, serveMedia} from './windows/mediaProtocol';
import {windowModeFrom, type WindowMode} from './windows/testWindows';

const BAD_ENVIRONMENT_EXIT_CODE = 1;
const UI_STATE_FILE = 'app.json';
const RECOVERY_FOLDER = 'recovery';
const THUMBNAIL_FOLDER = join('cache', 'thumbnails');

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
      const recoveryFolder = join(app.getPath('userData'), RECOVERY_FOLDER);
      const session = await openRecoverySession({folder: recoveryFolder, log});
      const appConfig = await openAppConfig({
        file: join(app.getPath('userData'), UI_STATE_FILE),
        log,
      });
      const ui = registerUiState(appConfig, log);
      const zoom = registerUiZoom(appConfig, log);
      const store = new LiveStore();
      const problems = registerProblemFeed({store, log});
      const dataStore = registerStore({
        log,
        isAnyOutputOn: () => isAnyOutputOn(store.state),
        appConfig,
        problems: problems.feed,
      });
      const recoveryRecord = new RecoveryRecordWriter({
        file: join(recoveryFolder, RECOVERY_RECORD_FILE),
        store,
        serviceId: openServiceIdOf(dataStore.content, log),
        log,
      });
      const disposeIpc = registerIpc(store, log, windowMode);
      const stopBible = registerBible({
        folder: join(app.getPath('userData'), 'bible'),
        settings: dataStore.settings,
        log,
      });
      // NOTE(0913vision): Register the reader owner before the output source;
      // their settings promise callbacks run in registration order.
      const stopOverlays = startOverlays({
        store,
        settings: dataStore.settings,
        log,
      });
      const stopLookSelection = registerLookSelection({
        store,
        selection: dataStore,
        log,
      });
      const analysis = startMediaAnalysis({
        media: dataStore.media,
        thumbnailFolder: join(app.getPath('userData'), THUMBNAIL_FOLDER),
        log,
      });
      const stopServingMedia = serveMedia({
        resolvePath: dataStore.findMediaFile,
        mediaRoots: dataStore.mediaRoots,
        analysisFile: analysis.lentFile,
        thumbnail: analysis.thumbnailOf,
        log,
      });
      const win = createControlWindow(log, windowMode, zoom);
      control = win;
      const closing = registerControlClose({control: win, log});
      shutdown.confirmWith(() => closing.confirmClose());
      const stopMediaBackend = registerMediaBackend({
        settings: dataStore.settings,
        uiState: appConfig,
        port: dataStore.mediaBackend,
        media: dataStore.media,
        control: win,
        windowMode,
        analysis,
        log,
      });
      const stopTextImport = registerTextImport({
        control: win,
        windowMode,
        log,
      });
      const outputs = startOutputs({
        store,
        settings: dataStore.settings,
        control: win,
        log,
        windowMode,
      });
      const stopAudio = registerAudioOutput({
        store,
        media: dataStore.media,
        log,
        windowMode,
      });
      const macros = registerMacros({
        store,
        data: dataStore,
        log,
        launch: session.crashed ? 'restore' : 'normal',
      });
      // NOTE(0913vision): Registered after the overlays, so the store has its
      // settings reader before 켤 때 화면 출력 sends output.set.
      const recovery = new RecoveryController({
        crashed: session.crashed,
        file: join(recoveryFolder, RECOVERY_RECORD_FILE),
        store,
        sources: recoverySources(dataStore, log),
        record: recoveryRecord,
        showOutputsOnLaunch: () =>
          showOutputsOnLaunch({store, settings: dataStore.settings, log}),
        runStartupMacros: macros.startFresh,
        log,
      });
      const stopRecoveryChannels = registerRecoveryChannels(recovery, log);
      recovery
        .start()
        .catch((error: unknown) =>
          log.error('could not start recovery', error),
        );
      const stopSoakScenario = registerSoakScenario(log, command =>
        dispatchLogged(store, command, log),
      );
      const stopSoakRecorder = registerSoakRecorder(log, {
        frameRates: outputs.frameRates,
      });
      // NOTE(0913vision): SAVE_LIMIT_MS can end the process before the last
      // step removes session.lock. The next launch then takes it for a crash,
      // the safe side (no startup macros), and logs that quitting didn't
      // finish. The record stops before the outputs close, so it keeps the
      // state from before the quit, and its last write is awaited only after
      // the data store closes, so it never delays a save.
      shutdown.add({
        name: 'mark the recovery session as quitting',
        run: () => session.markQuitting(),
      });
      shutdown.add({
        name: 'stop the recovery record',
        run: () => recoveryRecord.stop(),
      });
      // NOTE(0913vision): The soak scenario stops next, so it changes
      // nothing while the outputs close. Output windows turn a close into
      // "output off", so they are destroyed before Electron closes windows to
      // quit.
      shutdown.add({name: 'stop the soak scenario', run: stopSoakScenario});
      shutdown.add({name: 'stop text import', run: stopTextImport});
      shutdown.add({name: 'stop Bible lookup', run: stopBible});
      shutdown.add({name: 'stop the media backend', run: stopMediaBackend});
      shutdown.add({name: 'stop media analysis', run: analysis.dispose});
      shutdown.add({name: 'stop macros', run: macros.dispose});
      shutdown.add({name: 'stop audio', run: stopAudio});
      shutdown.add({name: 'stop overlays', run: stopOverlays});
      shutdown.add({name: 'stop Look selection', run: stopLookSelection});
      shutdown.add({name: 'stop the outputs', run: outputs.stop});
      shutdown.add({name: 'save the UI state', run: () => ui.dispose()});
      shutdown.add({name: 'stop UI zoom', run: () => zoom.dispose()});
      shutdown.add({name: 'save app.json', run: () => appConfig.flush()});
      shutdown.add({name: 'finish the soak record', run: stopSoakRecorder});
      shutdown.add({name: 'close the data store', run: dataStore.dispose});
      shutdown.add({name: 'stop serving media', run: stopServingMedia});
      shutdown.add({
        name: 'stop the close handshake',
        run: () => closing.dispose(),
      });
      shutdown.add({name: 'stop the problem feed', run: problems.dispose});
      shutdown.add({name: 'remove the IPC channels', run: disposeIpc});
      shutdown.add({
        name: 'remove the recovery channels',
        run: stopRecoveryChannels,
      });
      shutdown.add({
        name: 'finish the recovery record write',
        run: () => recoveryRecord.settled(),
      });
      shutdown.add({
        name: 'finish the recovery session',
        run: () => session.cleanExit(),
      });
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
