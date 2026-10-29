import {resolve} from 'node:path';
import {
  ContentStore,
  type ContentEvents,
  type DocumentFiles,
} from '../src/main/store/contentStore';
import {resolveLocations} from '../src/main/store/locations';
import {recordingLogger} from '../src/main/displays/testing';
import {SettingsStore} from '../src/main/store/settingsStore';
import {parseSettingsDocument} from '../src/shared/schema/settingsDocuments';
import type {
  LibrarySong,
  SongChange,
} from '../src/shared/schema/contentDocuments';

/** A real content store with in-memory files and a window-like event feed. */
export function contentFixture() {
  const texts = new Map<string, string>();
  const changes = new Set<(change: SongChange) => void>();
  const lists = new Set<(entries: readonly LibrarySong[]) => void>();
  const files: DocumentFiles = {
    write: async request => {
      texts.set(request.target.file, request.text);
      return {ok: true, value: undefined};
    },
    remove: async target => {
      texts.delete(target.file);
      return {ok: true, value: undefined};
    },
  };
  const events: ContentEvents = {
    songChanged: change => {
      for (const listener of changes) listener(change);
    },
    songsListChanged: entries => {
      for (const listener of lists) listener(entries);
    },
    serviceChanged: () => undefined,
    servicesListChanged: () => undefined,
    templateChanged: () => undefined,
    templatesListChanged: () => undefined,
  };
  const {locations} = resolveLocations(
    {},
    {documents: resolve('C:/data'), developmentFolder: null},
  );
  const labels = parseSettingsDocument({
    name: 'labels',
    revision: 1,
    access: 'editable',
    value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
  });
  if (!labels.ok) throw new Error('Invalid label fixture');
  const log = recordingLogger();
  const settings = new SettingsStore({
    documents: new Map([['labels', labels.value]]),
    problems: [],
    log,
    saving: {folder: locations.settings, files, delayMs: 0},
  });
  const store = new ContentStore({
    locations,
    songs: new Map(),
    services: new Map(),
    templates: new Map(),
    files,
    events,
    log,
    settings,
    writeDelayMs: 0,
  });
  return {
    store,
    texts,
    dispose: async () => {
      store.dispose();
      await settings.dispose();
    },
    songs: {
      list: async () => store.songList(),
      get: async (id: string) => store.song(id),
      subscribe: (listener: (change: SongChange) => void) => {
        changes.add(listener);
        return () => {
          changes.delete(listener);
        };
      },
      subscribeList: (listener: (entries: readonly LibrarySong[]) => void) => {
        lists.add(listener);
        return () => {
          lists.delete(listener);
        };
      },
    },
  };
}
