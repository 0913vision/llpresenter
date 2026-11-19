import {app, dialog, ipcMain, BrowserWindow, type IpcMainEvent} from 'electron';
import {serviceEndpoints} from '@contracts/ipc/service';
import {LaunchIdle} from './store/launchIdle';
import {registerUpdates, updatesAllowed} from './update/register';
import {
  cancelRestartOutputs,
  restoreRestartOutputs,
  saveRestartOutputs,
} from './update/restartOutputs';
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
import type {createLogger, Logger} from './log';
import {registerIpc} from './ipc';
import {diagnosticsText} from './diagnostics';
import {showOutputsOnLaunch} from './outputs/launch';
import {registerProblemFeed} from './problemFeed';
import {startOutputs} from './outputs/start';
import {ShutdownCoordinator} from './shutdown';
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
import {createControlWindow} from './windows/control';
import {controlRecoveryPlacement} from './windows/controlRecovery';
import {ControlHeartbeat} from './windows/controlHeartbeat';
import {GraphicsRecovery} from './windows/graphicsRecovery';
import {announceReloadAfterCrash} from './windows/reloadNotice';
import {registerSettingsWindow} from './windows/settingsWindow';
import {registerSlidesEditorWindow} from './windows/slidesEditor';
import {isItemOfKind} from '@core/schema/service';
import {registerAudioOutput} from './windows/audio';
import {registerPlaybackProblems} from './outputs/playbackProblems';
import {registerControlClose} from './windows/controlClose';
import {serveMedia} from './windows/mediaProtocol';
import {registerPictureChannels} from './windows/pictureChannels';
import type {WindowMode} from './windows/testWindows';
import {completeSplashStep} from './windows/splash';

const UI_STATE_FILE = 'app.json';
const RECOVERY_FOLDER = 'recovery';
const THUMBNAIL_FOLDER = join('cache', 'thumbnails');

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

export function start(
  splash: BrowserWindow,
  windowMode: WindowMode,
  log: ReturnType<typeof createLogger>,
): void {
  let control: BrowserWindow | null = null;
  let lastGpuState: {reason: string; exitCode: number} | null = null;
  let graphicsRecovery: GraphicsRecovery | undefined;
  prepareSoakGarbageCollection();

  app.on('second-instance', () => bringBack(control, windowMode));
  app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU') {
      lastGpuState = {reason: details.reason, exitCode: details.exitCode};
      if (details.reason !== 'clean-exit') {
        graphicsRecovery?.request('gpu-loss');
      }
    }
    log.error('child process gone', details);
  });
  app.on('window-all-closed', () => app.quit());
  const shutdown = new ShutdownCoordinator({app, log});

  app
    .whenReady()
    .then(async () => {
      const stopPictureChannels = registerPictureChannels();
      shutdown.add({name: 'stop picture painter', run: stopPictureChannels});
      const recoveryFolder = join(app.getPath('userData'), RECOVERY_FOLDER);
      const session = await openRecoverySession({folder: recoveryFolder, log});
      if (session.crashed) {
        await cancelRestartOutputs(recoveryFolder).catch((error: unknown) =>
          log.warn('Could not discard update restart screens', error),
        );
      }
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
        onServiceChanged: () => {
          if (store.state.blackScreen) store.dispatch({type: 'black.toggle'});
          store.dispatch({type: 'item.stop'});
        },
        appConfig,
        problems: problems.feed,
      });
      dataStore.settings
        .then(() => completeSplashStep(splash, 'settings'))
        .catch((error: unknown) => log.error('settings startup failed', error));
      dataStore.content
        .then(() => completeSplashStep(splash, 'content'))
        .catch((error: unknown) => log.error('content startup failed', error));
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
      const win = createControlWindow(log, windowMode, {
        attachControl: contents => zoom.attachControl(contents),
        outputsReady: launchIdle.ready,
        startMaximized:
          (await dataStore.settings)?.preferences().general.startMaximized ??
          true,
      });
      completeSplashStep(splash, 'window');
      const closeSplash = (): void => {
        if (!splash.isDestroyed()) splash.close();
      };
      control = win;
      let activeControl = win;
      const controlRef = {
        get webContents() {
          return activeControl.webContents;
        },
      };
      const watchControl = (watched: BrowserWindow): void => {
        watched.webContents.once('did-finish-load', () => {
          if (watched === activeControl) completeSplashStep(splash, 'renderer');
        });
        watched.once('ready-to-show', () => {
          if (watched === activeControl) completeSplashStep(splash, 'paint');
        });
        const handoff = (): void => {
          if (watched === activeControl) closeSplash();
        };
        if (windowMode === 'normal') watched.once('show', handoff);
        else watched.once('ready-to-show', handoff);
        watched.webContents.on('did-fail-load', (_event, code, ...details) => {
          const isMainFrame = details[2];
          if (
            watched !== activeControl ||
            splash.isDestroyed() ||
            !isMainFrame ||
            code === -3
          ) {
            return;
          }
          log.error('control window failed to load during startup', {code});
          closeSplash();
          if (windowMode === 'normal') {
            dialog.showErrorBox(
              '시작 오류',
              '화면을 불러오지 못했습니다. 프로그램을 다시 실행해 주세요.',
            );
          }
          app.quit();
        });
        let scriptAnswered = false;
        const heartbeat = new ControlHeartbeat(
          () => {
            scriptAnswered = false;
            const answer = watched.webContents
              .executeJavaScript('0')
              .then(() => {
                scriptAnswered = true;
              });
            if (
              windowMode !== 'offscreen' &&
              (!watched.isVisible() || watched.isMinimized())
            ) {
              return answer;
            }
            return Promise.all([
              answer,
              watched.webContents.capturePage({
                x: 0,
                y: 0,
                width: 1,
                height: 1,
              }),
            ]);
          },
          () => {
            log.error('control window not responding', {lastGpuState});
            if (scriptAnswered) {
              const gpu = app
                .getAppMetrics()
                .find(process => process.type === 'GPU');
              if (gpu !== undefined) {
                try {
                  process.kill(gpu.pid);
                  return;
                } catch (error) {
                  log.warn('could not restart the stalled GPU process', error);
                }
              }
            }
            graphicsRecovery?.request('control-hang');
          },
        );
        watched.webContents.on('did-start-loading', () => heartbeat.stop());
        watched.webContents.on('did-finish-load', () => heartbeat.start());
        watched.once('closed', () => heartbeat.stop());
        watched.once('closed', () => {
          if (control !== watched) return;
          control = null;
          app.quit();
        });
      };
      watchControl(win);
      const serviceReady = (event: IpcMainEvent, ...args: unknown[]): void => {
        if (
          event.sender !== activeControl.webContents ||
          event.senderFrame !== activeControl.webContents.mainFrame ||
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
      let stopReloadNotice = announceReloadAfterCrash(win.webContents, () =>
        problems.feed.report({kind: 'control-reloaded'}),
      );
      const settingsWindow = registerSettingsWindow({
        config: appConfig,
        get control() {
          return activeControl;
        },
        zoom,
        mode: windowMode,
        log,
        screens: {config: appConfig},
      });
      const editorWindowContext = {
        get control() {
          return activeControl;
        },
        config: appConfig,
        zoom,
        mode: windowMode,
        log,
      };
      const slidesEditorWindow = registerSlidesEditorWindow({
        ...editorWindowContext,
        get control() {
          return activeControl;
        },
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
      const stopFonts = registerFonts(controlRef, log, launchIdle.ready);
      let closing = registerControlClose({control: win, log});
      shutdown.confirmWith(
        async requireSaved =>
          (await settingsWindow.close(requireSaved)) &&
          (await slidesEditorWindow.close()) &&
          (await closing.confirmClose(requireSaved)),
      );
      const stopUpdates = registerUpdates({
        control: controlRef,
        store,
        log,
        shutdown,
        ready: launchIdle.ready,
        version: app.getVersion(),
        verifyClean: () => recoveryMarkerRemoved(recoveryFolder),
        savePending: dataStore.savePending,
        resumeAfterCancelledInstall: () => closing.resume(),
        prepareRestart: async version => {
          await store.settled();
          return saveRestartOutputs({
            folder: recoveryFolder,
            version,
            state: store.state,
            log,
          });
        },
        cancelRestart: () => cancelRestartOutputs(recoveryFolder),
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
        get control() {
          return activeControl;
        },
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
        uiState: appConfig,
        get control() {
          return activeControl;
        },
        windowMode,
        log,
      });
      const stopPowerPointImport = registerPowerPointImport({
        uiState: appConfig,
        get control() {
          return activeControl;
        },
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
      const makeOutputs = (owner: BrowserWindow) =>
        startOutputs({
          problems: problems.feed,
          playbackProblems: playbackProblems.board,
          onPrepared: () => launchIdle.outputsReady(),
          store,
          settings: dataStore.settings,
          saveScreenSettings: dataStore.applySettingsEdit,
          control: owner,
          log,
          windowMode,
          presenter: true,
        });
      let outputs = makeOutputs(win);
      graphicsRecovery = new GraphicsRecovery(
        async reason => {
          const previous = activeControl;
          const placement = controlRecoveryPlacement(previous);
          const replacement = createControlWindow(log, windowMode, {
            attachControl: contents => zoom.attachControl(contents),
            outputsReady: launchIdle.ready,
            startMaximized: placement.startMaximized,
          });
          if (placement.bounds !== undefined) {
            replacement.setBounds(placement.bounds);
          }
          closing.dispose();
          stopReloadNotice();
          activeControl = replacement;
          control = replacement;
          settingsWindow.replaceControl(replacement);
          closing = registerControlClose({control: replacement, log});
          stopReloadNotice = announceReloadAfterCrash(
            replacement.webContents,
            () => problems.feed.report({kind: 'control-reloaded'}),
          );
          watchControl(replacement);
          replacement.webContents.once('did-finish-load', () => {
            problems.feed.report({kind: 'graphics-recovered'});
          });
          // NOTE(0913vision): The main live store retains the output switches and slide.
          outputs.stop();
          outputs = makeOutputs(replacement);
          if (!previous.isDestroyed()) previous.destroy();
          log.info('recreated windows after graphics failure', {reason});
          await Promise.resolve();
        },
        error => log.error('could not recover graphics windows', error),
      );
      if (
        windowMode === 'offscreen' &&
        !app.isPackaged &&
        process.env['LLP_TEST_GPU_CRASH'] === '1'
      ) {
        const crashGpu = (event: IpcMainEvent, kind: unknown): void => {
          if (
            event.sender !== activeControl.webContents ||
            (kind !== 'crash' && kind !== 'hang')
          ) {
            return;
          }
          const hidden = new BrowserWindow({
            show: false,
            webPreferences: {offscreen: true},
          });
          hidden.webContents.once('render-process-gone', () => {
            if (!hidden.isDestroyed()) hidden.destroy();
          });
          hidden.loadURL(`chrome://gpu${kind}`).catch((error: unknown) => {
            log.info('GPU test navigation ended', {kind, error: String(error)});
          });
          setTimeout(() => {
            if (!hidden.isDestroyed()) hidden.destroy();
          }, 90000);
        };
        ipcMain.on('test:gpu-failure', crashGpu);
        shutdown.add({
          name: 'stop GPU test hook',
          run: () => {
            ipcMain.removeListener('test:gpu-failure', crashGpu);
          },
        });
      }
      shutdown.add({
        name: 'stop graphics recovery',
        run: () => graphicsRecovery?.stop(),
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
        showOutputsOnLaunch: async () => {
          const restored = await restoreRestartOutputs({
            folder: recoveryFolder,
            crashed: session.crashed,
            version: app.getVersion(),
            settings: dataStore.settings,
            store,
            log,
          });
          if (!restored) {
            await showOutputsOnLaunch({
              store,
              settings: dataStore.settings,
              log,
            });
          }
        },
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
        frameRates: () => outputs.frameRates(),
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
      shutdown.add({name: 'stop the outputs', run: () => outputs.stop()});
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
        run: () => stopReloadNotice(),
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
      quitAfterSmokeTest(win, log, windowMode);
      log.info('started', {
        version: app.getVersion(),
        electron: process.versions.electron,
      });
    })
    .catch((error: unknown) => {
      log.error('failed to start', error);
      if (!splash.isDestroyed()) {
        splash.close();
      }
      app.quit();
    });
}
