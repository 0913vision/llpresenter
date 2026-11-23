import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {isAnyOutputOn} from '@core/schema/live';
import {registerWindowLog} from '../base/windowLog';
import {registerBible} from '../bible/register';
import {registerBibleAi} from '../bible/registerAi';
import {diagnosticsText} from './diagnostics';
import {loginItemsAllowed, registerLaunchAtLogin} from './launchAtLogin';
import {registerLiveChannels} from '../live/channels';
import {startOverlays} from '../live/overlays';
import {registerThemeOutput} from '../live/themes';
import {startMediaAnalysis} from '../media/analysis';
import {registerLibrarySearch} from '../search/register';
import {registerLibraryLocations} from '../store/locationsChannels';
import {serveMedia} from '../windows/mediaProtocol';
import {registerWindowChannels} from '../windows/windowChannels';
import type {Foundation} from './foundation';
import {startRecoveryRecord} from './recoveryRecord';

const BIBLE_FOLDER = 'bible';
const LOG_FOLDER = 'logs';
const THUMBNAIL_FOLDER = join('cache', 'thumbnails');

/** The parts that run before there is a control window. */
export type Services = ReturnType<typeof startServices>;

function startWindowChannels(
  {windowMode, data, launch, log}: Foundation,
  isControlWindow: (win: BrowserWindow) => boolean,
): () => void {
  const logDirectory = join(app.getPath('userData'), LOG_FOLDER);
  return registerWindowChannels(log, {
    windowMode,
    isControlWindow,
    app: {
      name: app.getName(),
      version: app.getVersion(),
      logDirectory,
      diagnostics: diagnosticsText({
        logDirectory,
        dataFolder: app.getPath('userData'),
        screens: async () => (await data.settings)?.get('screens'),
        launch: () => launch.report(),
        log,
      }),
      setVerbose: on => log.setVerbose(on),
      isVerbose: () => log.verbose,
    },
  });
}

/** Starts what does not need the control window. */
export function startServices(
  foundation: Foundation,
  isControlWindow: (win: BrowserWindow) => boolean,
) {
  const {store, data, appConfig, log, shutdown} = foundation;
  const stopLaunchAtLogin = registerLaunchAtLogin({
    settings: data.settings,
    applyEdit: data.applySettingsEdit,
    loginItems: app,
    enabled: loginItemsAllowed(app.isPackaged, process.platform),
    log,
  });
  const stopLocations = registerLibraryLocations({
    config: appConfig,
    settings: data,
    isAnyOutputOn: () => isAnyOutputOn(store.state),
    log,
  });
  const record = startRecoveryRecord(foundation);
  const stopLiveChannels = registerLiveChannels(store, log);
  const stopWindowLog = registerWindowLog(log);
  const stopWindowChannels = startWindowChannels(foundation, isControlWindow);
  const stopSearch = registerLibrarySearch(data.songs, log);
  const stopBible = registerBible({
    folder: join(app.getPath('userData'), BIBLE_FOLDER),
    settings: data.settings,
    log,
  });
  shutdown.add({name: 'stop local Bible AI', run: registerBibleAi({log})});
  // NOTE(0913vision): Register the reader owner before the output source;
  // their settings promise callbacks run in registration order.
  const stopOverlays = startOverlays({store, settings: data.settings, log});
  const stopThemeOutput = registerThemeOutput({store, data, log});
  const analysis = startMediaAnalysis({
    media: data.media,
    thumbnailFolder: join(app.getPath('userData'), THUMBNAIL_FOLDER),
    log,
  });
  const stopServingMedia = serveMedia({
    resolvePath: data.findMediaFile,
    mediaRoots: data.mediaRoots,
    analysisFile: analysis.lentFile,
    thumbnail: analysis.thumbnailOf,
    log,
  });
  return {
    record,
    analysis,
    stopLaunchAtLogin,
    stopLocations,
    stopLiveChannels,
    stopWindowLog,
    stopWindowChannels,
    stopSearch,
    stopBible,
    stopOverlays,
    stopThemeOutput,
    stopServingMedia,
  };
}
