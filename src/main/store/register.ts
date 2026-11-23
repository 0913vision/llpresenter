import {appEndpoints} from '@contracts/ipc/app';
import {backupFailedProblem, type AppProblem} from '@core/schema/appProblem';
import type {EditResult} from '@core/schema/contentEdit';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import type {SettingsReader} from '@core/schema/settingsReader';
import {app, shell} from 'electron';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {ProblemFeed} from '../base/problemFeed';
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
import type {MediaBackendPort} from './mediaBackend';
import {registerMediaChannels} from './mediaChannels';
import {registerMediaUses} from './mediaUses';
import {LoadingMediaLibrary} from './mediaLibrary';
import {openMediaStore} from './mediaLoader';
import {SUNDAY_PICTURES} from './bundledPictures';
import type {MediaStore} from './mediaStore';
import {openContent, type OpenedContent, type SongFeed} from './openContent';
import {SaveFailures} from './saveFailures';
import {registerSaveProblems} from './saveProblems';
import {backupGate} from './backup';
import {registerServiceChannels} from './serviceChannels';
import {createSettingsAccess, type SettingsAccess} from './settingsAccess';
import {registerSettingsChannels} from './settingsChannels';
import {openSettingsStore, type SettingsProblemListener} from './settingsStore';
import {SkippedFiles, startSkippedFileProblems} from './skippedFiles';
import {contentProblems, logLoadedStore, upkeepAtLaunch} from './storeUpkeep';
import {defaultPreferences} from '@core/schema/preferences';

export interface StoreRegistration {
  readonly log: Logger;
  readonly launchIdle?: Promise<boolean>;
  /** Whether any output is on. A backup never starts while one is. */
  readonly isAnyOutputOn: () => boolean;
  readonly onServiceChanged?: () => void;
  /** `app.json`, opened once at launch with `openAppConfig`. */
  readonly appConfig: AppConfigView &
    Pick<AppConfigFile, 'setLastServiceId' | 'flush' | 'savePending'>;
  /** Where the data folders default to. Electron's folders by default. */
  readonly context?: () => LocationContext;
  /** The app's problem cards, which list and push the waiting saves. */
  readonly problems: ProblemFeed;
}

/** What the main process wiring uses of the data store. */
export interface DataStore extends SettingsAccess {
  /** Flushes every store without disposing it and reports failed writes explicitly. */
  readonly savePending: () => Promise<boolean>;
  readonly content: Promise<ContentStore | null>;
  /** The songs of the 라이브러리, once the data is read. */
  readonly songs: Promise<SongFeed | null>;
  readonly settings: Promise<SettingsReader | null>;
  /** Applies a whole-file settings edit, for the few modules that write a setting. */
  readonly applySettingsEdit: (edit: SettingsEdit) => Promise<EditResult>;
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
   * The file of user media or a bundled theme picture, once the data is read,
   * or `null` when the ID is unknown.
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
  launchIdle,
  isAnyOutputOn,
  onServiceChanged,
  appConfig,
  context = electronLocationContext,
  problems,
}: StoreRegistration): DataStore {
  const ipc = new IpcHost(log);
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
        pictures: SUNDAY_PICTURES,
        discard: file => shell.trashItem(file),
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
  const opened = openContent(loading, log, {
    settings,
    media,
    failures: saveFailures,
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
  const serviceChannels = registerServiceChannels(opened, appConfig, {
    log,
    onServiceChanged,
  });
  const removeMediaUses = registerMediaUses(
    {media, settings, content: opened},
    log,
  );
  const removeContentChannels = registerContentChannels(contentOf(opened), log);
  const removeLibrarySong = registerLibrarySong(
    opened.then(ready => ready?.library ?? null),
    log,
  );
  let backupProblem: AppProblem | null = null;
  const stopBackupCompletion = backupGate.subscribeCompleted(() => {
    if (backupProblem === null) return;
    backupProblem = null;
    problems.push({kind: 'backup-recovered'});
  });
  const removeBackupProblem = problems.addStanding(() =>
    backupProblem === null ? [] : [backupProblem],
  );
  const upkeepStore = Promise.all([loading, settings]).then(([store, ready]) =>
    store === null
      ? null
      : {...store, preferences: ready?.preferences() ?? defaultPreferences},
  );
  const upkeep = upkeepAtLaunch(upkeepStore, isAnyOutputOn, {
    log,
    ...(launchIdle === undefined ? {} : {launchIdle}),
    onBackupFailed: folder => {
      backupProblem = backupFailedProblem(folder);
      problems.push(backupProblem);
    },
  });
  const mediaLibrary = new LoadingMediaLibrary(
    media.then(store => (store === null ? null : {media: store})),
    SUNDAY_PICTURES,
  );
  const savePending = async (): Promise<boolean> => {
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
  };
  ipc.query(appEndpoints.savePending, savePending);
  return {
    savePending,
    content: contentOf(opened),
    songs: opened.then(ready => ready?.songs ?? null),
    settings,
    applySettingsEdit: async edit => {
      const store = await settings;
      return store === null
        ? {
            ok: false,
            error: {reason: 'not-found', message: 'Settings are unavailable'},
          }
        : store.apply(edit);
    },
    media,
    mediaBackend: mediaChannels.port,
    readSettings: settingsAccess.readSettings,
    subscribeSettingsChanges: settingsAccess.subscribeSettingsChanges,
    subscribeSettingsProblems: settingsChannels.subscribe,
    dispose: async () => {
      settingsAccess.dispose();
      const serviceClosing = serviceChannels.dispose();
      const mediaClosing = mediaChannels.dispose();
      await settingsChannels.dispose();
      await serviceClosing;
      await mediaClosing;
      ipc.close();
      removeMediaUses();
      removeContentChannels();
      removeLibrarySong();
      await upkeep;
      const ready = await opened;
      ready?.removeSettings();
      ready?.feed.dispose();
      try {
        await ready?.content.flush();
      } finally {
        ready?.content.dispose();
        stopSkippedFiles();
        removeSkippedFiles();
        removeBackupProblem();
        stopBackupCompletion();
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
