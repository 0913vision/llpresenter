import {app} from 'electron';
import {launchEndpoints} from '@contracts/ipc/launch';
import {VIEW_TASK_IDS} from '@core/schema/app/launch';
import {IpcHost, type Caller} from '../base/ipcHost';
import {registerFonts} from '../fonts/register';
import {registerTextImport} from '../import/text/register';
import {registerPowerPointImport} from '../import/powerpoint/registerPowerPoint';
import {registerMediaBackend} from '../media/register';
import {registerSongReveal} from '../store/content/revealSong';
import {recoveryMarkerRemoved} from '../update/recovery';
import {registerUpdates, updatesAllowed} from '../update/register';
import {
  cancelRestartOutputs,
  saveRestartOutputs,
} from '../update/restartOutputs';
import {registerSettingsWindow} from '../windows/settingsWindow';
import type {ControlOwner} from './controlOwner';
import type {Foundation} from './foundation';
import type {Services} from './services';

/** The parts that work for the control window. */
export type ControlFeatures = ReturnType<typeof startControlFeatures>;

/** Tells when the control window has its data, which ends the launch. */
function watchReadiness(
  {data, launch, launchIdle, log, shutdown}: Foundation,
  control: ControlOwner,
): void {
  const ipc = new IpcHost(log);
  const isControl = ({contents, isMainFrame}: Caller): boolean =>
    contents === control.webContents && isMainFrame;
  ipc.message(
    launchEndpoints.preparing,
    ({task, done, total, ended}, caller) => {
      if (!isControl(caller)) return;
      launch.advance(task, done, total);
      if (ended) launch.finish(task);
    },
  );
  ipc.signal(launchEndpoints.ready, caller => {
    if (!isControl(caller)) return;
    for (const task of VIEW_TASK_IDS) launch.finish(task);
    data.content.then(
      () => launchIdle.serviceReady(),
      (error: unknown) => log.warn('Could not confirm launch readiness', error),
    );
  });
  shutdown.add({
    name: 'stop startup readiness',
    run: () => {
      ipc.close();
    },
  });
}

function startUpdates(foundation: Foundation, control: ControlOwner): void {
  const {store, data, launchIdle, recoveryFolder, windowMode, log, shutdown} =
    foundation;
  const stop = registerUpdates({
    control,
    store,
    log,
    shutdown,
    ready: launchIdle.ready,
    version: app.getVersion(),
    verifyClean: () => recoveryMarkerRemoved(recoveryFolder),
    savePending: data.savePending,
    resumeAfterCancelledInstall: () => control.resumeClosing(),
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
      testing: windowMode === 'offscreen' || process.env.NODE_ENV === 'test',
    }),
  });
  shutdown.add({name: 'stop update channels', run: stop});
}

/** Starts what works for the control window that `control` has. */
export function startControlFeatures(
  foundation: Foundation,
  {analysis}: Services,
  control: ControlOwner,
) {
  const {data, appConfig, zoom, launchIdle, windowMode, log, shutdown} =
    foundation;
  watchReadiness(foundation, control);
  const settingsWindow = registerSettingsWindow({
    config: appConfig,
    get control() {
      return control.window;
    },
    zoom,
    mode: windowMode,
    log,
    screens: {config: appConfig},
  });
  const stopFonts = registerFonts(control, log, launchIdle.ready);
  shutdown.confirmWith(
    async requireSaved =>
      (await settingsWindow.close(requireSaved)) &&
      (await control.confirmClose(requireSaved)),
  );
  startUpdates(foundation, control);
  const stopMediaBackend = registerMediaBackend({
    uiState: appConfig,
    get control() {
      return control.window;
    },
    windowMode,
    log,
    settings: data.settings,
    port: data.mediaBackend,
    media: data.media,
    analysis,
  });
  const stopSongReveal = registerSongReveal({
    fileOf: async songId =>
      (await data.content)?.storedSongs().get(songId)?.file,
    windowMode,
    log,
  });
  const stopTextImport = registerTextImport({
    uiState: appConfig,
    get control() {
      return control.window;
    },
    windowMode,
    log,
  });
  const stopPowerPointImport = registerPowerPointImport({
    uiState: appConfig,
    get control() {
      return control.window;
    },
    windowMode,
    log,
    media: data.media,
  });
  return {
    settingsWindow,
    stopFonts,
    stopMediaBackend,
    stopSongReveal,
    stopTextImport,
    stopPowerPointImport,
  };
}
