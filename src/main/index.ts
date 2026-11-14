import {app, ipcMain, type BrowserWindow, type IpcMainEvent} from 'electron';
import {serviceEndpoints} from '@contracts/ipc/service';
import {LaunchIdle} from './store/launchIdle';
import {registerUpdates, updatesAllowed} from './update/register';
import {recoveryMarkerRemoved} from './update/recovery';
import {join} from 'node:path';
import {isAnyOutputOn} from '@core/live/state';
import {registerBible} from './bible/register';
import {registerBibleAi} from './bible/registerAi';
import {registerFonts} from './fonts/register';
import {registerTextImport} from './import/register';
import {registerPowerPointImport} from './import/registerPowerPoint';
import {startMediaAnalysis} from './media/analysis';
import {registerMediaBackend} from './media/register';
import {registerSongReveal} from './store/revealSong';
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
import {registerThemeOutput} from './live/themes';
import {registerSlideAdvance} from './live/slideAdvance';
import {registerSlidesProjection} from './live/slidesProjection';
import {createLogger, flushWithin, type Logger} from './log';
import {registerIpc} from './ipc';
import {diagnosticsText} from './diagnostics';
import {showOutputsOnLaunch} from './outputs/launch';
import {registerProblemFeed} from './problemFeed';
import {startOutputs} from './outputs/start';
import {LOG_FLUSH_LIMIT_MS, ShutdownCoordinator} from './shutdown';
import {
  deferSoakScenario,
  prepareSoakGarbageCollection,
  registerSoakRecorder,
  registerSoakScenario,
} from './soak';
import {openAppConfig} from './store/appConfigFile';
import {registerStore} from './store/register';
import {loginItemsAllowed, registerLaunchAtLogin} from './launchAtLogin';
import {registerLibraryLocations} from './store/locationsChannels';
import {registerUiZoom} from './store/uiZoom';
import {registerUiState} from './uiState/register';
import {
  applyUserDataOverride,
  defaultUserDataPath,
  type UserDataProblem,
} from './userData';
import {createControlWindow} from './windows/control';
import {announceReloadAfterCrash} from './windows/reloadNotice';
import {registerSettingsWindow} from './windows/settingsWindow';
import {registerSongEditorWindow} from './windows/songEditor';
import {registerSlidesEditorWindow} from './windows/slidesEditor';
import {isItemOfKind} from '@core/schema/service';
import {registerAudioOutput} from './windows/audio';
import {registerPlaybackProblems} from './outputs/playbackProblems';
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
  defaultUserDataPath(app.getPath('appData')),
);

registerMediaScheme();
prepareSoakGarbageCollection();

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
      const launchIdle = new LaunchIdle();
      if (app.isPackaged && windowMode === 'offscreen') {
        launchIdle.ready
          .then(ready => {
            if (ready) log.info('installer smoke ready');
          })
          .catch((error: unknown) =>
            log.warn('Could not record installer smoke readiness', error),
          );
      }
      shutdown.add({
        name: 'cancel deferred launch work',
        run: () => launchIdle.dispose(),
      });
      const problems = registerProblemFeed({store, log});
      const dataStore = registerStore({
        log,
        launchIdle: launchIdle.ready,
        isAnyOutputOn: () => isAnyOutputOn(store.state),
        appConfig,
        problems: problems.feed,
      });
      const stopLaunchAtLogin = registerLaunchAtLogin({
        settings: dataStore.settings,
        applyEdit: dataStore.applySettingsEdit,
        loginItems: app,
        enabled: loginItemsAllowed(app.isPackaged, process.platform),
        log,
      });
      const stopLocations = registerLibraryLocations({
        config: appConfig,
        settings: dataStore,
        isAnyOutputOn: () => isAnyOutputOn(store.state),
        log,
      });
      let recordFailed = false;
      const removeRecordProblem = problems.feed.addStanding(() =>
        recordFailed
          ? [{kind: 'protection-write', target: 'record', failed: true}]
          : [],
      );
      const recoveryRecord = new RecoveryRecordWriter({
        file: join(recoveryFolder, RECOVERY_RECORD_FILE),
        store,
        serviceId: openServiceIdOf(dataStore.content, log),
        onFailureChanged: failed => {
          recordFailed = failed;
          problems.feed.push({
            kind: 'protection-write',
            target: 'record',
            failed,
          });
        },
        log,
      });
      const stopOutputPersistence = store.connectOutputPersistence(state =>
        recoveryRecord.persistOutputs(state),
      );
      const disposeIpc = registerIpc(store, log, {
        windowMode,
        isControlWindow: candidate => candidate === control,
        app: {
          name: app.getName(),
          version: app.getVersion(),
          logDirectory: join(app.getPath('userData'), 'logs'),
          diagnostics: diagnosticsText({
            logDirectory: join(app.getPath('userData'), 'logs'),
            dataFolder: app.getPath('userData'),
            screens: async () => (await dataStore.settings)?.get('screens'),
            log,
          }),
          setVerbose: on => log.setVerbose(on),
          isVerbose: () => log.verbose,
        },
      });
      const stopBible = registerBible({
        session: dataStore.bible,
        log,
      });
      const stopBibleAi = registerBibleAi({log});
      shutdown.add({name: 'stop local Bible AI', run: stopBibleAi});
      // NOTE(0913vision): Register the reader owner before the output source;
      // their settings promise callbacks run in registration order.
      const stopOverlays = startOverlays({
        store,
        settings: dataStore.settings,
        log,
      });
      const stopThemeOutput = registerThemeOutput({
        store,
        data: dataStore,
        log,
      });
      const slidesProjection = registerSlidesProjection({
        content: dataStore.content,
        settings: dataStore.settings,
        log,
      });
      const stopSlideAdvance = registerSlideAdvance({
        store,
        data: dataStore,
        log,
        projection: slidesProjection,
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
      const serviceReady = (event: IpcMainEvent, ...args: unknown[]): void => {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          args.length !== 0
        ) {
          return;
        }
        void dataStore.content.then(
          () => launchIdle.serviceReady(),
          (error: unknown) =>
            log.warn('Could not confirm launch readiness', error),
        );
      };
      ipcMain.on(serviceEndpoints.ready.channel, serviceReady);
      shutdown.add({
        name: 'stop startup readiness',
        run: () => {
          ipcMain.removeListener(serviceEndpoints.ready.channel, serviceReady);
        },
      });
      const stopReloadNotice = announceReloadAfterCrash(win.webContents, () =>
        problems.feed.report({kind: 'control-reloaded'}),
      );
      const settingsWindow = registerSettingsWindow({
        control: win,
        zoom,
        mode: windowMode,
        log,
        screens: {store, config: appConfig},
      });
      const editorWindowContext = {
        control: win,
        config: appConfig,
        zoom,
        mode: windowMode,
        log,
      };
      const songEditorWindow = registerSongEditorWindow({
        ...editorWindowContext,
        hasSong: async id =>
          ((await dataStore.content)?.song(id) ?? null) !== null,
      });
      const slidesEditorWindow = registerSlidesEditorWindow({
        ...editorWindowContext,
        hasItem: async target => {
          const document = (await dataStore.content)?.service(target.serviceId);
          const item = document?.service.order.find(
            row => row.id === target.itemId,
          );
          return (
            document?.access !== 'readOnly' &&
            item !== undefined &&
            isItemOfKind(item, 'slides')
          );
        },
      });
      const stopFonts = registerFonts(win, log, launchIdle.ready);
      const closing = registerControlClose({control: win, log});
      shutdown.confirmWith(
        async requireSaved =>
          (await settingsWindow.close(requireSaved)) &&
          (await slidesEditorWindow.close()) &&
          (await closing.confirmClose(requireSaved)),
      );
      const stopUpdates = registerUpdates({
        control: win,
        store,
        log,
        shutdown,
        ready: launchIdle.ready,
        version: app.getVersion(),
        verifyClean: () => recoveryMarkerRemoved(recoveryFolder),
        savePending: dataStore.savePending,
        resumeAfterCancelledInstall: () => closing.resume(),
        enabled: updatesAllowed({
          packaged: app.isPackaged,
          platform: process.platform,
          testing:
            windowMode === 'offscreen' || process.env.NODE_ENV === 'test',
        }),
      });
      shutdown.add({name: 'stop update channels', run: stopUpdates});
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
      const stopSongReveal = registerSongReveal({
        fileOf: async songId =>
          (await dataStore.content)?.storedSongs().get(songId)?.file,
        windowMode,
        log,
      });
      const stopTextImport = registerTextImport({
        control: win,
        windowMode,
        log,
      });
      const stopPowerPointImport = registerPowerPointImport({
        control: win,
        windowMode,
        log,
        media: dataStore.media,
        ownedMedia: dataStore.media,
      });
      const playbackProblems = registerPlaybackProblems({
        log,
        enabled: source =>
          source === 'audio' || store.state.outputs[source] === true,
        subscribe: changed => store.subscribe(changed),
      });
      const outputs = startOutputs({
        problems: problems.feed,
        playbackProblems: playbackProblems.board,
        onPrepared: () => launchIdle.outputsReady(),
        store,
        settings: dataStore.settings,
        saveScreenSettings: dataStore.applySettingsEdit,
        control: win,
        log,
        windowMode,
      });
      const stopAudio = registerAudioOutput({
        playbackProblems: playbackProblems.board,
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
      const stopSoakScenario = deferSoakScenario(
        Promise.all([dataStore.settings, dataStore.media]),
        () =>
          registerSoakScenario(log, command =>
            dispatchLogged(store, command, log),
          ),
        log,
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
        run: async () => {
          await store.settled();
          stopOutputPersistence();
          recoveryRecord.stop();
          removeRecordProblem();
        },
      });
      // NOTE(0913vision): The soak scenario stops next, so it changes
      // nothing while the outputs close. Output windows turn a close into
      // "output off", so they are destroyed before Electron closes windows to
      // quit.
      shutdown.add({name: 'stop the soak scenario', run: stopSoakScenario});
      shutdown.add({name: 'stop text import', run: stopTextImport});
      shutdown.add({name: 'stop PowerPoint import', run: stopPowerPointImport});
      shutdown.add({
        name: 'stop the settings window',
        run: settingsWindow.dispose,
      });
      shutdown.add({
        name: 'stop the Windows sign-in item',
        run: stopLaunchAtLogin,
      });
      shutdown.add({
        name: 'stop the location channels',
        run: stopLocations,
      });
      shutdown.add({
        name: 'stop the song editor window',
        run: songEditorWindow.dispose,
      });
      shutdown.add({
        name: 'stop the slides editor window',
        run: slidesEditorWindow.dispose,
      });
      shutdown.add({name: 'stop Bible lookup', run: stopBible});
      shutdown.add({name: 'stop font enumeration', run: stopFonts});
      shutdown.add({name: 'stop the media backend', run: stopMediaBackend});
      shutdown.add({name: 'stop song reveal', run: stopSongReveal});
      shutdown.add({name: 'stop media analysis', run: analysis.dispose});
      shutdown.add({name: 'stop macros', run: macros.dispose});
      shutdown.add({name: 'stop audio', run: stopAudio});
      shutdown.add({
        name: 'stop playback problems',
        run: playbackProblems.stop,
      });
      shutdown.add({name: 'stop overlays', run: stopOverlays});
      shutdown.add({name: 'stop theme output', run: stopThemeOutput});
      shutdown.add({name: 'stop slide advance', run: stopSlideAdvance});
      shutdown.add({
        name: 'stop slides projection',
        run: slidesProjection.dispose,
      });
      shutdown.add({name: 'stop the outputs', run: outputs.stop});
      shutdown.add({name: 'save the UI state', run: () => ui.dispose()});
      shutdown.add({name: 'stop UI zoom', run: () => zoom.dispose()});
      shutdown.add({name: 'save app.json', run: () => appConfig.savePending()});
      shutdown.add({name: 'finish the soak record', run: stopSoakRecorder});
      shutdown.add({
        name: 'save pending store edits',
        run: dataStore.savePending,
      });
      shutdown.add({name: 'close the data store', run: dataStore.dispose});
      shutdown.add({name: 'stop serving media', run: stopServingMedia});
      shutdown.add({
        name: 'stop the close handshake',
        run: () => closing.dispose(),
      });
      shutdown.add({name: 'stop the problem feed', run: problems.dispose});
      shutdown.add({
        name: 'stop the control reload notice',
        run: stopReloadNotice,
      });
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
