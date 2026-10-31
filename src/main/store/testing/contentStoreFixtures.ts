import type {Result} from '@core/common/result';
import type {ContentEdit} from '@core/schema/contentEdit';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {
  serviceIdSchema,
  songIdSchema,
  templateIdSchema,
} from '@core/schema/ids';
import {parseService, parseTemplate} from '@core/schema/service';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {testId} from '@core/schema/testHelpers';
import {join, resolve} from 'node:path';
import {onTestFinished, vi} from 'vitest';
import type {Logger} from '../../log';
import {
  ContentStore,
  type ContentEvents,
  type ContentStoreOptions,
  type DocumentFiles,
} from '../contentStore';
import type {StoredFile} from '../library';
import {resolveLocations} from '../locations';
import type {RecoveryTarget} from '../recoveryCopies';
import {type WaitingSave} from '../saveFailures';
import type {SaveRequest} from '../saver';
import {SettingsStore} from '../settingsStore';
import {
  EVENING_ID,
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
} from '../testFiles';

/** A neutral fixture value; declaring it does not read or write files. */
export const ROOT = resolve('/data');

/** A neutral fixture value; declaring it does not read or write files. */
export const {locations} = resolveLocations(
  {},
  {documents: ROOT, developmentFolder: null},
);

/** A neutral fixture value; declaring it does not read or write files. */
export const SONG = testId(songIdSchema, HYMN_ONE_ID);

/** A neutral fixture value; declaring it does not read or write files. */
export const SUNDAY = testId(serviceIdSchema, SUNDAY_ID);

/** A neutral fixture value; declaring it does not read or write files. */
export const EVENING = testId(serviceIdSchema, EVENING_ID);

/** A neutral fixture value; declaring it does not read or write files. */
export const TEMPLATE_ID = 'c63a2e74-9a3b-4c4d-8e5f-607182930415';

/** A neutral fixture value; declaring it does not read or write files. */
export const TEMPLATE = testId(templateIdSchema, TEMPLATE_ID);

/** Parses a neutral stored-document fixture without filesystem access. */
export function stored<T>(
  parse: (text: string, file: string) => Result<LoadedFile<T>, FileError>,
  json: object,
  file: string,
): StoredFile<T> {
  const parsed = parse(JSON.stringify(json), file);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return {...parsed.value, file};
}

/** Builds an invented grouped song document without reading a file. */
export function songFile(json: object = hymnOne()) {
  return stored(parseGroupedSong, json, join(locations.songs, 'hymn.llsong'));
}

/** Builds a neutral service document without reading or writing files. */
export function serviceFile(id: string, items: readonly object[]) {
  return stored(
    parseService,
    service(id, '2026-11-01T11:00', items),
    join(locations.services, `${id}.llservice`),
  );
}

/** Builds a neutral template document without reading or writing files. */
export function templateFile(
  items: readonly object[] = [
    {id: itemId(21), header: '찬양'},
    {id: itemId(22), slot: 'song', title: '찬양'},
  ],
  id = TEMPLATE_ID,
) {
  return stored(
    parseTemplate,
    {
      format: 'llservice',
      schemaVersion: 1,
      id,
      name: '주일',
      order: items,
    },
    join(locations.templates, `${id}.llservice`),
  );
}

/** Mock file results and configurable refusals, without filesystem ownership. */
export interface MockFiles extends DocumentFiles {
  readonly written: string[];
  readonly removed: string[];
  readonly texts: Map<string, string>;
  readonly waiting: WaitingSave[];
  readonly saved: string[];
  failing: ReadonlySet<string>;
  failAll: boolean;
  reminded: number;
}

/** Records isolated mock file operations and refusals without writing files. */
export function mockFiles(): MockFiles {
  const files: MockFiles = {
    written: [],
    removed: [],
    texts: new Map(),
    waiting: [],
    saved: [],
    failing: new Set(),
    failAll: false,
    reminded: 0,
    failures: {
      waiting: save => {
        files.waiting.push(save);
      },
      saved: file => {
        files.saved.push(file);
      },
      remind: () => {
        files.reminded++;
      },
    },
    write: (request: SaveRequest) => {
      const {file} = request.target;
      files.written.push(file);
      if (files.failAll || files.failing.has(file)) {
        return Promise.resolve({
          ok: false,
          error: {file, message: 'disk full'},
        });
      }
      files.texts.set(file, request.text);
      return Promise.resolve({ok: true, value: undefined});
    },
    remove: (target: RecoveryTarget) => {
      files.removed.push(target.file);
      if (files.failAll || files.failing.has(target.file)) {
        return Promise.resolve({
          ok: false,
          error: {file: target.file, message: 'disk full'},
        });
      }
      files.texts.delete(target.file);
      return Promise.resolve({ok: true, value: undefined});
    },
  };
  return files;
}

/** Creates isolated mock content announcements without registering IPC. */
export function mockEvents() {
  return {
    songChanged: vi.fn(),
    songsListChanged: vi.fn(),
    serviceChanged: vi.fn(),
    servicesListChanged: vi.fn(),
    templateChanged: vi.fn(),
    templatesListChanged: vi.fn(),
  } satisfies ContentEvents;
}

/** Creates isolated mock log callbacks without filesystem output. */
export function quietLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

/**
 * Builds a ContentStore with mock files and test cleanup, without loading a
 * data directory.
 */
export function setUp(
  services: ReadonlyArray<
    StoredFile<ReturnType<typeof serviceFile>['data']>
  > = [],
  options: Partial<
    Pick<
      ContentStoreOptions,
      'writeDelayMs' | 'openServiceId' | 'templates' | 'songs' | 'settings'
    >
  > = {},
  files = mockFiles(),
) {
  const events = mockEvents();
  const song = songFile({...hymnOne(), copyright: 'public domain'});
  const log = quietLog();
  const store = new ContentStore({
    locations,
    songs: new Map([[HYMN_ONE_ID, song]]),
    services: new Map(services.map(item => [item.data.id, item])),
    templates: new Map([[TEMPLATE_ID, templateFile()]]),
    files,
    events,
    log,
    writeDelayMs: 0,
    ...options,
  });
  onTestFinished(() => store.dispose());
  return {store, files, events, song, log};
}

/** Builds a current-revision update for a fixture song without applying it. */
export function songEdit(
  store: ContentStore,
  title: string,
  baseRevision: number,
): ContentEdit {
  const document = store.song(SONG);
  if (document === null) throw new Error('Missing fixture song');
  return {
    type: 'song.update',
    song: {...document.song, title},
    baseRevision,
  };
}

/** Builds mocked settings and content stores for imports without writing files. */
export function importSetup(
  services: Parameters<typeof setUp>[0] = [],
  options: Parameters<typeof setUp>[1] = {},
  labelOptions: {
    readonly access?: 'editable' | 'readOnly';
    readonly count?: number;
  } = {},
) {
  const files = mockFiles();
  const labels = parseSettingsDocument({
    name: 'labels',
    revision: 1,
    access: labelOptions.access ?? 'editable',
    value: {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: Array.from({length: labelOptions.count ?? 0}, (_, index) => ({
        name: `Existing ${index}`,
        color: 'teal',
        key: null,
      })),
      future: 'kept',
    },
  });
  if (!labels.ok) throw new Error('Invalid labels fixture');
  const settings = new SettingsStore({
    documents: new Map([['labels', labels.value]]),
    problems: [],
    log: quietLog(),
    saving: {folder: locations.settings, files, delayMs: 0},
  });
  onTestFinished(() => settings.dispose());
  return {...setUp(services, {...options, settings}, files), settings};
}

/** A neutral fixture value; declaring it does not read or write files. */
export const importedDraft = {
  title: 'Invented import',
  slides: [{label: 'New label', lines: ['Invented line']}],
};
