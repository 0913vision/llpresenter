import {DEFAULT_LABELS} from './defaults';
import {defaultPreferences} from '@core/schema/preferences';
import {serviceEndpoints} from '@contracts/ipc/service';
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
      settings?.preferences().backupCopies ?? defaultPreferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    onCopyResult: (file, ok) => failures.copyResult?.(file, ok),
    reportCopyProblem: problem =>
      log.warn('could not keep a recovery copy', problem),
  });
  let feed: OpenServiceFeed | null = null;
  const events = broadcastEvents(log, () => {
    feed?.refresh();
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
      return document?.name === 'labels'
        ? document.value.labels
        : DEFAULT_LABELS;
    },
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
      hasMedia: id => (media?.fileOf(id) ?? store.media.fileOf(id)) !== null,
    },
    service => broadcast(serviceEndpoints.changed.channel, service, log),
    error => log.error('could not refresh the open 예배 순서', error),
  );
  const removeSettingsListener =
    settings?.subscribe(document => {
      if (document.name === 'labels') feed.refresh();
    }) ?? (() => undefined);
  const removeMedia =
    media?.subscribe(() => {
      feed.refresh();
    }) ?? (() => undefined);
  const removeSettings = () => {
    removeSettingsListener();
    removeMedia();
  };
  feed.refresh();
  return {content, feed, search, removeSettings, library};
}
