import {DEFAULT_LABELS} from '../settings/defaults';
import type {SongChange} from '@core/schema/services/contentDocuments';
import {defaultPreferences} from '@core/schema/app/preferences';
import type {Song} from '@core/schema/songs/song';
import {serviceEndpoints} from '@contracts/ipc/service';
import {pushToWindows} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import {pushContentEvents} from './contentChannels';
import {ContentStore} from './contentStore';
import {documentFiles} from '../files/documentFiles';
import {type LoadedStore} from '../locations/fileStore';
import {type LibrarySongSources} from './librarySong';
import type {MediaStore} from '../media/mediaStore';
import {OpenServiceFeed} from './openServiceFeed';
import {RecoveryCopies} from '../files/recoveryCopies';
import {type SaveFailureSink} from '../files/saveFailures';
import {Saver} from '../files/saver';
import {type SettingsStore} from '../settings/settingsStore';

/** The songs that are stored, and their changes. */
export interface SongFeed {
  songs(): Iterable<Song>;
  subscribeSongs(listener: (change: SongChange) => void): () => void;
}

/**
 * The initialized content, library and current-service feed. The owner
 * retains the existing flush/dispose and listener-removal responsibilities.
 */
export interface OpenedContent {
  readonly library: LibrarySongSources;
  readonly content: ContentStore;
  readonly feed: OpenServiceFeed;
  readonly songs: SongFeed;
  readonly removeSettings: () => void;
}

/**
 * Opens the existing content/feed composition after loading and its
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
    return createContent(store, log, {
      settings: await readers.settings,
      media: await readers.media,
      failures: readers.failures,
    });
  } catch (error: unknown) {
    log.error('could not open the songs and 예배 순서', error);
    return null;
  }
}

function createContent(
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
): OpenedContent {
  const songListeners = new Set<(change: SongChange) => void>();
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
  const events = pushContentEvents(log, () => {
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
        for (const listener of songListeners) listener(change);
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
    service => pushToWindows(serviceEndpoints.changed, service, log),
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
  const songs: SongFeed = {
    songs: () => [...content.storedSongs().values()].map(({data}) => data),
    subscribeSongs: listener => {
      songListeners.add(listener);
      return () => {
        songListeners.delete(listener);
      };
    },
  };
  return {content, feed, songs, removeSettings, library};
}
