import {app, ipcMain} from 'electron';
import type {FileError} from '@shared/schema/fileFormat';
import {Channels} from '@shared/ipc';
import {defaultPreferences} from '@shared/schema/preferences';
import type {Logger} from '../log';
import type {ProblemFeed} from '../problemFeed';
import {registerLibrarySearch} from '../search/register';
import {buildSongSearchIndex, type SongSearchIndex} from '../search/songIndex';
import {Backups, type BackupOutcome} from './backup';
import {
  broadcast,
  broadcastEvents,
  registerContentChannels,
} from './contentChannels';
import {ContentStore} from './contentStore';
import {documentFiles} from './documentFiles';
import {
  loadStore,
  type AppConfigView,
  type LoadedStore,
  type StoreContext,
} from './fileStore';
import {dataFileFolders, type LocationContext} from './locations';
import {LoadingMediaLibrary} from './mediaLibrary';
import {openMediaStore} from './mediaLoader';
import {registerMediaChannels, type MediaBackendPort} from './mediaChannels';
import type {MediaStore} from './mediaStore';
import {OpenServiceFeed} from './openServiceFeed';
import {RecoveryCopies} from './recoveryCopies';
import {SaveFailures, type SaveFailureSink} from './saveFailures';
import {registerSaveProblems} from './saveProblems';
import {SkippedFiles, startSkippedFileProblems} from './skippedFiles';
import {Saver} from './saver';
import {removeStaleTempFiles} from './staleTempFiles';
import {settingsNames} from '@shared/schema/settingsDocuments';
import {settingsLocation} from './settingsFile';
import {
  openSettingsStore,
  type SettingsProblemListener,
  type SettingsReader,
  type SettingsStore,
} from './settingsStore';
import {registerSettingsChannels} from './settingsChannels';
import {createSettingsAccess, type SettingsAccess} from './settingsAccess';
import {createLookSelection, type LookSelectionPort} from './lookSelection';
import {registerServiceChannels} from './serviceChannels';
import type {AppConfigFile} from './appConfigFile';
import {registerLibrarySong, type LibrarySongSources} from './librarySong';

const MAX_LOGGED_PROBLEMS = 50;

interface OpenedContent {
  readonly library: LibrarySongSources;
  readonly content: ContentStore;
  readonly feed: OpenServiceFeed;
  readonly search: SongSearchIndex;
  readonly removeSettings: () => void;
}

export interface StoreRegistration {
  readonly log: Logger;
  /** Whether any output is on. A backup never starts while one is. */
  readonly isAnyOutputOn: () => boolean;
  /** `app.json`, opened once at launch with `openAppConfig`. */
  readonly appConfig: AppConfigView &
    Pick<AppConfigFile, 'setLastServiceId' | 'flush'>;
  /** Where the data folders default to. Electron's folders by default. */
  readonly context?: () => LocationContext;
  /** The app's problem cards, which list and push the waiting saves. */
  readonly problems: ProblemFeed;
}

/** What the main process wiring uses of the data store. */
export interface DataStore extends SettingsAccess, LookSelectionPort {
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
  const lookSelection = createLookSelection(settings, log);
  const serviceChannels = registerServiceChannels(opened, appConfig, log);
  ipcMain.handle(Channels.preferencesGet, async () => {
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
  ipcMain.handle(Channels.appSavePending, async () => {
    try {
      const [ready, readySettings, readyMedia] = await Promise.all([
        opened,
        settings,
        media,
      ]);
      await ready?.content.flush();
      await readySettings?.flush();
      await readyMedia?.flush();
      await appConfig.flush();
      return saveFailures.problems().length === 0;
    } catch (error: unknown) {
      log.error('could not save pending edits before closing', error);
      return false;
    }
  });
  return {
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
      ipcMain.removeHandler(Channels.preferencesGet);
      ipcMain.removeHandler(Channels.appSavePending);
      removeContentChannels();
      removeSearch();
      removeLibrarySong();
      await upkeep;
      const ready = await opened;
      ready?.removeSettings();
      await ready?.feed.dispose();
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

async function openContent(
  loading: Promise<LoadedStore | null>,
  log: Logger,
  readers: {
    readonly settings: Promise<SettingsStore | null>;
    readonly media: Promise<MediaStore | null>;
    readonly failures: SaveFailureSink;
  },
): Promise<OpenedContent | null> {
  const store = await loading;
  if (store === null) {
    return null;
  }
  try {
    return await createContent(store, log, {
      settings: await readers.settings,
      media: await readers.media,
      failures: readers.failures,
    });
  } catch (error: unknown) {
    log.error('could not open the songs and 예배 순서', error);
    return null;
  }
}

async function createContent(
  store: LoadedStore,
  log: Logger,
  {
    settings,
    media,
    failures,
  }: {
    readonly settings: SettingsStore | null;
    readonly media: MediaStore | null;
    readonly failures: SaveFailureSink;
  },
): Promise<OpenedContent> {
  const search = await buildSongSearchIndex(
    [...store.songs.values()].map(({data}) => data),
  );
  const copies = new RecoveryCopies({
    folder: store.locations.recovery,
    keep: () =>
      settings?.preferences().backupCopies ?? store.preferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: problem =>
      log.warn('could not keep a recovery copy', problem),
  });
  let feed: OpenServiceFeed | null = null;
  const events = broadcastEvents(log, () => {
    feed
      ?.refresh()
      .catch((error: unknown) =>
        log.error('could not refresh the open service', error),
      );
  });
  const content = new ContentStore({
    locations: store.locations,
    songs: store.songs,
    services: store.services,
    templates: store.templates,
    openServiceId: store.openServiceId,
    files: documentFiles({saver, copies, log, failures}),
    events: {
      ...events,
      songChanged: change => {
        search.change(change);
        events.songChanged(change);
      },
    },
    log,
  });
  const library: LibrarySongSources = {
    song: id => content.song(id),
    get labels() {
      const document = settings?.get('labels');
      return document?.name === 'labels' ? document.value.labels : store.labels;
    },
    backgroundOf: id => media?.backgroundOf(id) ?? store.media.backgroundOf(id),
  };
  feed = new OpenServiceFeed(
    {
      get serviceId() {
        return content.openServiceId;
      },
      get labels() {
        return library.labels;
      },
      content,
      backgroundOf: library.backgroundOf,
    },
    service => broadcast(Channels.serviceChanged, service, log),
    error => log.error('could not refresh the open 예배 순서', error),
  );
  const removeSettingsListener =
    settings?.subscribe(document => {
      if (document.name === 'labels') {
        feed
          .refresh()
          .catch((error: unknown) =>
            log.error('could not refresh labels in the open service', error),
          );
      }
    }) ?? (() => undefined);
  const removeMedia =
    media?.subscribe(() => {
      feed
        .refresh()
        .catch((error: unknown) =>
          log.error('could not refresh media in the open service', error),
        );
    }) ?? (() => undefined);
  const removeSettings = () => {
    removeSettingsListener();
    removeMedia();
  };
  await feed.refresh();
  return {content, feed, search, removeSettings, library};
}

async function contentOf(
  opened: Promise<OpenedContent | null>,
): Promise<ContentStore | null> {
  return (await opened)?.content ?? null;
}

// NOTE(0913vision): Leftover temporary files go before the backup, so a backup
// never copies them.
async function upkeepAtLaunch(
  loading: Promise<LoadedStore | null>,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  const store = await loading;
  if (store === null) {
    return;
  }
  await removeLeftoverTempFiles(store, log);
  await backUpAtLaunch(store, isAnyOutputOn, log);
}

async function removeLeftoverTempFiles(
  store: LoadedStore,
  log: Logger,
): Promise<void> {
  for (const name of dataFileFolders) {
    for (const problem of await removeStaleTempFiles(store.locations[name])) {
      log.warn('could not remove a leftover temporary file', problem);
    }
  }
}

async function backUpAtLaunch(
  store: LoadedStore,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  try {
    const backups = new Backups({
      locations: store.locations,
      developmentFolder: store.developmentFolder,
      preferences: () => store.preferences.backup,
      isAnyOutputOn,
    });
    logBackupOutcome(await backups.atLaunch(), log);
  } catch (error: unknown) {
    log.error('the launch backup failed', error);
  }
}

// NOTE(0913vision): The songs, 예배 순서, 틀, labels, and preferences files
// skipped at startup; the settings problem feed reports the settings and media
// files.
function contentProblems(store: LoadedStore): readonly FileError[] {
  return store.problems.filter(
    problem =>
      ![...settingsNames, 'media'].some(
        name => settingsLocation(store.locations, name).file === problem.file,
      ),
  );
}

function logLoadedStore(store: LoadedStore, log: Logger): void {
  log.info('read the data folder', {
    dataRoot: store.locations.dataRoot,
    songs: store.songs.size,
    services: store.services.size,
    openServiceId: store.openServiceId,
  });
  const problems = contentProblems(store);
  for (const problem of problems.slice(0, MAX_LOGGED_PROBLEMS)) {
    log.warn('skipped a data file or a part of one', problem);
  }
  const unlogged = problems.length - MAX_LOGGED_PROBLEMS;
  if (unlogged > 0) {
    log.warn(`skipped ${unlogged} more data files or parts of them`);
  }
}

function logBackupOutcome(outcome: BackupOutcome, log: Logger): void {
  switch (outcome.kind) {
    case 'done':
      log.info('backed up the data', {folder: outcome.backup.folder});
      for (const problem of outcome.backup.problems) {
        log.warn('could not delete an old backup', problem);
      }
      return;
    case 'skipped':
      log.info('skipped the launch backup', {reason: outcome.reason});
      return;
    case 'failed':
      log.warn('the launch backup failed', outcome.problem);
      return;
  }
}
