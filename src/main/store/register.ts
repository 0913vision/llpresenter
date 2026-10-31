import {appEndpoints} from '@contracts/ipc/app';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {defaultPreferences} from '@core/schema/preferences';
import type {SettingsReader} from '@core/schema/settingsReader';
import {app, ipcMain} from 'electron';
import {join} from 'node:path';
import {BibleLookupSession} from '../bible/lookup';
import type {Logger} from '../log';
import type {ProblemFeed} from '../problemFeed';
import {registerLibrarySearch} from '../search/register';
import type {AppConfigFile} from './appConfigFile';
import {registerContentChannels} from './contentChannels';
import {ContentStore} from './contentStore';
import {
  loadStore,
  type AppConfigView,
  type LoadedStore,
  type StoreContext,
} from './fileStore';
import {registerLibrarySong} from './librarySong';
import {type LocationContext} from './locations';
import {createLookSelection, type LookSelectionPort} from './lookSelection';
import {registerMediaChannels, type MediaBackendPort} from './mediaChannels';
import {LoadingMediaLibrary} from './mediaLibrary';
import {openMediaStore} from './mediaLoader';
import type {MediaStore} from './mediaStore';
import {openContent, type OpenedContent} from './openContent';
import {SaveFailures} from './saveFailures';
import {registerSaveProblems} from './saveProblems';
import {registerServiceChannels} from './serviceChannels';
import {createSettingsAccess, type SettingsAccess} from './settingsAccess';
import {registerSettingsChannels} from './settingsChannels';
import {openSettingsStore, type SettingsProblemListener} from './settingsStore';
import {SkippedFiles, startSkippedFileProblems} from './skippedFiles';
import {contentProblems, logLoadedStore, upkeepAtLaunch} from './storeUpkeep';

export interface StoreRegistration {
  readonly log: Logger;
  /** Whether any output is on. A backup never starts while one is. */
  readonly isAnyOutputOn: () => boolean;
  /** `app.json`, opened once at launch with `openAppConfig`. */
  readonly appConfig: AppConfigView &
    Pick<AppConfigFile, 'setLastServiceId' | 'flush' | 'savePending'>;
  /** Where the data folders default to. Electron's folders by default. */
  readonly context?: () => LocationContext;
  /** The app's problem cards, which list and push the waiting saves. */
  readonly problems: ProblemFeed;
}

/** What the main process wiring uses of the data store. */
export interface DataStore extends SettingsAccess, LookSelectionPort {
  readonly bible: Pick<BibleLookupSession, 'lookup'>;
  readonly content: Promise<ContentStore | null>;
  readonly settings: Promise<SettingsReader | null>;
  readonly media: Promise<MediaStore | null>;
  readonly mediaBackend: MediaBackendPort;
  readonly subscribeSettingsProblems: (
    listener: SettingsProblemListener,
  ) => () => void;
  /**
   * Removes the handlers and resolves once the launch backup has ended and
   * every change that waits is saved, so quitting never cuts a backup off or
   * loses an edit.
   */
  readonly dispose: () => Promise<void>;
  /**
   * The file of a media id from `media.json`, once the data is read, or
   * `null` when there is none.
   */
  readonly findMediaFile: (mediaId: string) => Promise<string | null>;
  /** The folders media files may come from; none before the data is read. */
  readonly mediaRoots: () => readonly string[];
}

/**
 * Reads the data at launch, answers `service:get` with the open 예배 순서 and
 * pushes it again when it changes, answers content and normalized-preferences
 * reads, finds media files by id, and then runs the launch backup once. A
 * window that asks before the data is read waits for it. Never throws: a failure, or a
 * data folder that a link leads outside `LLP_USER_DATA`, is logged, and the
 * service answer is `null` and preferences fall back to their defaults.
 */
export function registerStore({
  log,
  isAnyOutputOn,
  appConfig,
  context = electronLocationContext,
  problems,
}: StoreRegistration): DataStore {
  const loading = readStore(() => ({...context(), appConfig}), log);
  const saveFailures = new SaveFailures({log});
  const removeSaveProblems = registerSaveProblems(saveFailures, problems, log);
  const skippedFiles = new SkippedFiles(log);
  const removeSkippedFiles = problems.addStanding(() => skippedFiles.list());
  const settings = loading
    .then(store =>
      store === null ? null : openSettingsStore(store, log, saveFailures),
    )
    .catch((error: unknown) => {
      log.error('could not open app-wide settings', error);
      return null;
    });
  const media = loading
    .then(async store => {
      if (store === null) return null;
      const readySettings = await settings;
      const opened = await openMediaStore(store, {
        settings: readySettings,
        log,
        failures: saveFailures,
      });
      readySettings?.addProblems(opened.problems);
      return opened.store;
    })
    .catch((error: unknown) => {
      log.error('could not open the media list', error);
      return null;
    });
  const mediaChannels = registerMediaChannels(media, log);
  let bible: BibleLookupSession | undefined;
  let bibleClosed = false;
  const openBible = (): BibleLookupSession =>
    (bible ??= new BibleLookupSession({
      folder: join(app.getPath('userData'), 'bible'),
      settings,
      log,
    }));
  const bibleReader: Pick<BibleLookupSession, 'lookup'> = {
    lookup: request =>
      bibleClosed
        ? Promise.reject(new Error('Bible lookup is unavailable'))
        : openBible().lookup(request),
  };
  const opened = openContent(loading, log, {
    settings,
    media,
    failures: saveFailures,
    bible: bibleReader,
  });
  const settingsChannels = registerSettingsChannels(
    settings,
    log,
    async edit => {
      const [readyContent, readySettings] = await Promise.all([
        opened,
        settings,
      ]);
      if (readyContent === null || readySettings === null) {
        return {
          ok: false,
          error: {
            reason: 'not-found',
            message: 'The label list is unavailable',
          },
        };
      }
      return readyContent.content.renameLabel(readySettings, edit);
    },
  );
  const stopSkippedFiles = startSkippedFileProblems({
    skipped: skippedFiles,
    sources: {
      settings: settingsChannels.subscribe,
      content: loading.then(store =>
        store === null ? [] : contentProblems(store),
      ),
    },
    announce: problem => problems.push(problem),
    log,
  });
  const settingsAccess = createSettingsAccess(settings, log);
  const lookSelection = createLookSelection(settings, log);
  const serviceChannels = registerServiceChannels(opened, appConfig, log);
  ipcMain.handle(settingsEndpoints.preferences.channel, async () => {
    const ready = await settings;
    return (
      ready?.preferences() ?? (await loading)?.preferences ?? defaultPreferences
    );
  });
  const removeContentChannels = registerContentChannels(contentOf(opened), log);
  const removeSearch = registerLibrarySearch(
    opened.then(ready => ready?.search ?? null),
    log,
  );
  const removeLibrarySong = registerLibrarySong(
    opened.then(ready => ready?.library ?? null),
    log,
  );
  const upkeep = upkeepAtLaunch(loading, isAnyOutputOn, log);
  const mediaLibrary = new LoadingMediaLibrary(
    media.then(store => (store === null ? null : {media: store})),
  );
  ipcMain.handle(appEndpoints.savePending.channel, async () => {
    try {
      const [ready, readySettings, readyMedia] = await Promise.all([
        opened,
        settings,
        media,
      ]);
      await ready?.content.flush();
      await readySettings?.flush();
      await readyMedia?.flush();
      const configSaved = await appConfig.savePending();
      return configSaved && saveFailures.problems().length === 0;
    } catch (error: unknown) {
      log.error('could not save pending edits before closing', error);
      return false;
    }
  });
  return {
    get bible() {
      if (!bibleClosed) openBible();
      return bibleReader;
    },
    content: contentOf(opened),
    settings,
    media,
    mediaBackend: mediaChannels.port,
    readSettings: settingsAccess.readSettings,
    selectLook: lookSelection.selectLook,
    subscribeSettingsChanges: settingsAccess.subscribeSettingsChanges,
    subscribeSettingsProblems: settingsChannels.subscribe,
    dispose: async () => {
      settingsAccess.dispose();
      lookSelection.dispose();
      const serviceClosing = serviceChannels.dispose();
      const mediaClosing = mediaChannels.dispose();
      await settingsChannels.dispose();
      await serviceClosing;
      await mediaClosing;
      ipcMain.removeHandler(settingsEndpoints.preferences.channel);
      ipcMain.removeHandler(appEndpoints.savePending.channel);
      removeContentChannels();
      removeSearch();
      removeLibrarySong();
      await upkeep;
      const ready = await opened;
      ready?.removeSettings();
      await ready?.feed.dispose();
      bibleClosed = true;
      bible?.dispose();
      try {
        await ready?.content.flush();
      } finally {
        ready?.search.clear();
        ready?.content.dispose();
        stopSkippedFiles();
        removeSkippedFiles();
        removeSaveProblems();
        saveFailures.dispose();
      }
    },
    findMediaFile: mediaLibrary.findFile,
    mediaRoots: mediaLibrary.roots,
  };
}

/** Documents, and the `LLP_USER_DATA` folder if set. */
export function electronLocationContext(): LocationContext {
  const developmentFolder = process.env['LLP_USER_DATA'] ?? '';
  return {
    documents: app.getPath('documents'),
    developmentFolder: developmentFolder === '' ? null : developmentFolder,
  };
}

async function readStore(
  context: () => StoreContext,
  log: Logger,
): Promise<LoadedStore | null> {
  try {
    const loaded = await loadStore(context());
    if (!loaded.ok) {
      log.error('refused the data folder', loaded.error);
      return null;
    }
    logLoadedStore(loaded.value, log);
    return loaded.value;
  } catch (error: unknown) {
    log.error('could not read the data folder', error);
    return null;
  }
}

async function contentOf(
  opened: Promise<OpenedContent | null>,
): Promise<ContentStore | null> {
  return (await opened)?.content ?? null;
}
