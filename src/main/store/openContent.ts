import {serviceEndpoints} from '@contracts/ipc/service';
import type {BibleLookupSession} from '../bible/lookup';
import type {Logger} from '../log';
import {buildSongSearchIndex, type SongSearchIndex} from '../search/songIndex';
import {broadcast, broadcastEvents} from './contentChannels';
import {ContentStore} from './contentStore';
import {documentFiles} from './documentFiles';
import {type LoadedStore} from './fileStore';
import {type LibrarySongSources} from './librarySong';
import type {MediaStore} from './mediaStore';
import {OpenServiceFeed} from './openServiceFeed';
import {RecoveryCopies} from './recoveryCopies';
import {type SaveFailureSink} from './saveFailures';
import {Saver} from './saver';
import {type SettingsStore} from './settingsStore';

/**
 * The initialized content, search, library and current-service feed. The owner
 * retains the existing flush/dispose and listener-removal responsibilities.
 */
export interface OpenedContent {
  readonly library: LibrarySongSources;
  readonly content: ContentStore;
  readonly feed: OpenServiceFeed;
  readonly search: SongSearchIndex;
  readonly removeSettings: () => void;
}

/**
 * Opens the existing content/search/feed composition after loading and its
 * readers, or logs a startup failure and returns null. It does not register IPC
 * handlers or own application shutdown.
 */
export async function openContent(
  loading: Promise<LoadedStore | null>,
  log: Logger,
  readers: {
    readonly settings: Promise<SettingsStore | null>;
    readonly media: Promise<MediaStore | null>;
    readonly failures: SaveFailureSink;
    readonly bible: Pick<BibleLookupSession, 'lookup'>;
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
      bible: readers.bible,
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
    bible,
  }: {
    readonly settings: SettingsStore | null;
    readonly media: MediaStore | null;
    readonly failures: SaveFailureSink;
    readonly bible: Pick<BibleLookupSession, 'lookup'>;
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
    settings,
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
      bible,
    },
    service => broadcast(serviceEndpoints.changed.channel, service, log),
    error => log.error('could not refresh the open 예배 순서', error),
  );
  const removeSettingsListener =
    settings?.subscribe(document => {
      if (document.name === 'labels' || document.name === 'bible') {
        feed
          .refresh()
          .catch((error: unknown) =>
            log.error(
              'could not refresh item sources in the open service',
              error,
            ),
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
