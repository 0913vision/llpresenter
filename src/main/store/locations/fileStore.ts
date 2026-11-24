import {PartCounter, type OnProgress} from '../../base/launchTracker';
import {serviceDay} from '@core/services';
import type {Result} from '@core/common/result';
import type {FileError, LoadedFile} from '@core/schema/common/fileFormat';
import {parseMediaList} from '@core/schema/media/mediaList';
import {
  parseService,
  parseTemplate,
  type Service,
  type Template,
} from '@core/schema/services/service';
import {parseSong, type Song} from '@core/schema/songs/song';
import type {AppConfigFile} from './appConfigFile';
import {EMPTY_MEDIA_LIST} from '../settings/defaults';
import {listFiles, loadFiles, type StoredFile} from '../files/library';
import {
  buildMediaLibrary,
  type MediaLibrary,
  type MediaLibraryRead,
} from '../media/mediaLibrary';
import {
  confineLocations,
  resolveLocations,
  type DataLocations,
  type LocationContext,
} from './locations';
import {readSettingsFile, settingsLocation} from '../settings/settingsFile';
import {initialTemplates} from '../content/initialTemplates';

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

/** The default folders plus the view of `app.json`. */
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
  /** The 템플릿, by template id, read-only like the songs. */
  readonly templates: ReadonlyMap<string, StoredFile<Template>>;
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

type DataRead = Pick<
  LoadedStore,
  'songs' | 'services' | 'templates' | 'media' | 'problems'
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
  onProgress: OnProgress = () => undefined,
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
  const initialProblem = await initialTemplates(confined.value);
  const data = await readData(confined.value, onProgress);
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
        ...(initialProblem === null ? [] : [initialProblem]),
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
    if (newest === null || serviceDay(data.date) > serviceDay(newest.date)) {
      newest = data;
    }
  }
  return newest?.id ?? null;
}

async function readData(
  locations: DataLocations,
  onProgress: OnProgress,
): Promise<DataRead> {
  const counter = new PartCounter(onProgress);
  const listed = await Promise.all([
    listFiles(locations.songs, SONG_EXTENSION),
    listFiles(locations.services, SERVICE_EXTENSION),
    listFiles(locations.templates, SERVICE_EXTENSION),
  ]);
  counter.expect(
    listed.reduce((sum, files) => sum + (files.ok ? files.value.length : 0), 0),
  );
  const [songFiles, serviceFiles, templateFiles] = listed;
  const [songs, services, templates, media] = await Promise.all([
    loadFiles(songFiles, {parse: parseSong, counter}),
    loadFiles(serviceFiles, {parse: parseService, counter}),
    loadFiles(templateFiles, {parse: parseTemplate, counter}),
    readMedia(locations),
  ]);
  return {
    songs: songs.items,
    services: services.items,
    templates: templates.items,
    media: media.library,
    problems: [
      ...songs.problems,
      ...services.problems,
      ...templates.problems,
      ...media.problems,
    ],
  };
}

async function readMedia(locations: DataLocations): Promise<MediaLibraryRead> {
  const location = settingsLocation(locations, MEDIA_AREA);
  const {data, problems} = await readSettingsFile(location, parseMediaList);
  const built = buildMediaLibrary({
    items: (data ?? EMPTY_MEDIA_LIST).items,
    mediaFolder: locations.media,
    listFile: location.file,
  });
  return {library: built.library, problems: [...problems, ...built.problems]};
}

function ignoredProblem(file: string, field: string): FileError {
  return {kind: 'invalid', file, field, message: IGNORED_FOLDER_MESSAGE};
}
