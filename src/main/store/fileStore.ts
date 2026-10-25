import type {Result} from '@shared/result';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {parseLabels, type Label} from '@shared/schema/labels';
import {parseMediaList} from '@shared/schema/mediaList';
import {
  defaultPreferences,
  parsePreferences,
  withPreferenceDefaults,
  type Preferences,
} from '@shared/schema/preferences';
import {
  parseService,
  parseTemplate,
  type Service,
  type Template,
} from '@shared/schema/service';
import {parseSong, type Song} from '@shared/schema/song';
import type {AppConfigFile} from './appConfigFile';
import {DEFAULT_LABELS, EMPTY_MEDIA_LIST} from './defaults';
import {loadFolder, type StoredFile} from './library';
import {
  buildMediaLibrary,
  type MediaLibrary,
  type MediaLibraryRead,
} from './mediaLibrary';
import {
  confineLocations,
  resolveLocations,
  type DataLocations,
  type LocationContext,
} from './locations';
import {readSettingsFile, settingsLocation} from './settingsFile';

const LABELS_AREA = 'labels';
const PREFERENCES_AREA = 'preferences';
const MEDIA_AREA = 'media';
const SONG_EXTENSION = '.llsong';
const SERVICE_EXTENSION = '.llservice';
const IGNORED_FOLDER_MESSAGE =
  'Ignored: the folder is not absolute, or it is outside LLP_USER_DATA';

/** What the data store reads of `app.json`, which it opened once at launch. */
export type AppConfigView = Pick<
  AppConfigFile,
  'file' | 'locationFields' | 'lastServiceId'
>;

export interface StoreContext extends LocationContext {
  readonly appConfig: AppConfigView;
}

/** Everything the app read at launch, and what it couldn't read. */
export interface LoadedStore {
  readonly locations: DataLocations;
  /** The `LLP_USER_DATA` folder every data folder stays inside, or `null`. */
  readonly developmentFolder: string | null;
  /**
   * The song library, by song id. A song from a newer app version is
   * read-only (`access`).
   */
  readonly songs: ReadonlyMap<string, StoredFile<Song>>;
  /** The 예배 순서, by service id, read-only like the songs. */
  readonly services: ReadonlyMap<string, StoredFile<Service>>;
  /** The 틀, by template id, read-only like the songs. */
  readonly templates: ReadonlyMap<string, StoredFile<Template>>;
  readonly labels: readonly Label[];
  /** 환경설정, with the default for every field the file doesn't set. */
  readonly preferences: Preferences;
  /** The file of each media id from `media.json`, and the media folders. */
  readonly media: MediaLibrary;
  /**
   * The service 진행 opens: the last opened one when it loaded, otherwise the
   * one with the latest date, or `null` when there is none.
   */
  readonly openServiceId: string | null;
  /** Files that were skipped, or parts of files that were dropped. */
  readonly problems: readonly FileError[];
}

interface LabelsRead {
  readonly labels: readonly Label[];
  readonly problems: readonly FileError[];
}

interface PreferencesRead {
  readonly preferences: Preferences;
  readonly problems: readonly FileError[];
}

type DataRead = Pick<
  LoadedStore,
  | 'songs'
  | 'services'
  | 'templates'
  | 'labels'
  | 'preferences'
  | 'media'
  | 'problems'
>;

/**
 * Reads the data the app needs at launch. In development, it first checks that
 * no data folder leads outside `LLP_USER_DATA`, and reads nothing when one
 * does. Never throws.
 *
 * @returns The data, or why no data folder may be used.
 */
export async function loadStore(
  context: StoreContext,
): Promise<Result<LoadedStore, FileError>> {
  const {appConfig} = context;
  const {locations, ignored} = resolveLocations(
    appConfig.locationFields,
    context,
  );
  const confined = await confineLocations(locations, context.developmentFolder);
  if (!confined.ok) {
    return confined;
  }
  const data = await readData(confined.value, context.developmentFolder);
  return {
    ok: true,
    value: {
      ...data,
      locations,
      developmentFolder: context.developmentFolder,
      openServiceId: chooseOpenService(data.services, appConfig.lastServiceId),
      problems: [
        ...ignored.map(field => ignoredProblem(appConfig.file, field)),
        ...data.problems,
      ],
    },
  };
}

/**
 * The last opened service when it loaded, otherwise the one with the latest
 * date. Dates are `YYYY-MM-DDTHH:mm`, so they sort as text.
 */
export function chooseOpenService(
  services: ReadonlyMap<string, LoadedFile<Service>>,
  lastServiceId: string | undefined,
): string | null {
  if (lastServiceId !== undefined && services.has(lastServiceId)) {
    return lastServiceId;
  }
  let newest: Service | null = null;
  for (const {data} of services.values()) {
    if (newest === null || data.date > newest.date) {
      newest = data;
    }
  }
  return newest?.id ?? null;
}

async function readData(
  locations: DataLocations,
  developmentFolder: string | null,
): Promise<DataRead> {
  const songs = await loadFolder(locations.songs, SONG_EXTENSION, parseSong);
  const services = await loadFolder(
    locations.services,
    SERVICE_EXTENSION,
    parseService,
  );
  const templates = await loadFolder(
    locations.templates,
    SERVICE_EXTENSION,
    parseTemplate,
  );
  const labels = await readLabels(locations);
  const preferences = await readPreferences(locations);
  const media = await readMedia(locations, developmentFolder);
  return {
    songs: songs.items,
    services: services.items,
    templates: templates.items,
    labels: labels.labels,
    preferences: preferences.preferences,
    media: media.library,
    problems: [
      ...songs.problems,
      ...services.problems,
      ...templates.problems,
      ...labels.problems,
      ...preferences.problems,
      ...media.problems,
    ],
  };
}

async function readLabels(locations: DataLocations): Promise<LabelsRead> {
  const {data, problems} = await readSettingsFile(
    settingsLocation(locations, LABELS_AREA),
    parseLabels,
  );
  return {labels: data?.labels ?? DEFAULT_LABELS, problems};
}

async function readPreferences(
  locations: DataLocations,
): Promise<PreferencesRead> {
  const {data, problems} = await readSettingsFile(
    settingsLocation(locations, PREFERENCES_AREA),
    parsePreferences,
  );
  return {
    preferences:
      data === null ? defaultPreferences : withPreferenceDefaults(data),
    problems,
  };
}

async function readMedia(
  locations: DataLocations,
  developmentFolder: string | null,
): Promise<MediaLibraryRead> {
  const location = settingsLocation(locations, MEDIA_AREA);
  const {data, problems} = await readSettingsFile(location, parseMediaList);
  const built = buildMediaLibrary({
    items: (data ?? EMPTY_MEDIA_LIST).items,
    mediaFolder: locations.media,
    developmentFolder,
    listFile: location.file,
  });
  return {library: built.library, problems: [...problems, ...built.problems]};
}

function ignoredProblem(file: string, field: string): FileError {
  return {kind: 'invalid', file, field, message: IGNORED_FOLDER_MESSAGE};
}
