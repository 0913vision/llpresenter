import {powerpointApi, type PowerPointApi} from './powerpoint';
import {appApi, problemsApi, type AppApi, type ProblemsApi} from './app';
import {launchApi, type LaunchApi} from './launch';
import {updateApi, type UpdateApi} from './update';
import {bibleApi, type BibleApi} from './bible';
import {
  contentApi,
  contentEndpoints,
  documentApi,
  type ContentApi,
  type DocumentApi,
} from './content';
import type {IpcPort, WindowPlatform} from './endpoint';
import {libraryApi, type LibraryApi} from './library';
import {textImportApi, type TextImportApi} from './textImport';
import {liveApi, type LiveApi} from './live';
import {mediaApi, type MediaApi} from './media';
import {
  fontsApi,
  logApi,
  monitorsApi,
  outputApi,
  type FontsApi,
  type LogApi,
  type MonitorsApi,
  type OutputApi,
} from './output';
import {locationsApi, type LocationsApi} from './locations';
import {recoveryApi, type RecoveryApi} from './recovery';
import {serviceApi, type ServiceApi} from './service';
import {
  preferencesApi,
  settingsApi,
  type PreferencesApi,
  type SettingsApi,
} from './settings';
import {uiApi, type UiApi} from './ui';
import {windowApi, type WindowApi} from './window';
import type {
  LibrarySong,
  ServiceChange,
  ServiceDocument,
  ServiceEntry,
  SongChange,
  SongDocument,
  TemplateChange,
  TemplateDocument,
  TemplateEntry,
} from '@core/schema/services/contentDocuments';

/**
 * The API that the preload script exposes to windows as `window.llp`. Each
 * part is declared with its calls in its own file in this folder.
 */
export interface LlpApi {
  readonly update: UpdateApi;
  readonly bible: BibleApi;
  readonly app: AppApi;
  readonly launch: LaunchApi;
  readonly problems: ProblemsApi;
  readonly live: LiveApi;
  readonly window: WindowApi;
  readonly ui: UiApi;
  readonly log: LogApi;
  readonly monitors: MonitorsApi;
  readonly fonts: FontsApi;
  readonly output: OutputApi;
  readonly service: ServiceApi;
  readonly content: ContentApi;
  /** The 라이브러리 songs. Each read rejects, after logging, on a failure. */
  readonly songs: DocumentApi<LibrarySong, SongDocument, SongChange>;
  /**
   * The 예배 순서 files, for 준비 and for switching the open one. `service`
   * above is the open 예배 순서 as 진행 shows it.
   */
  readonly services: DocumentApi<ServiceEntry, ServiceDocument, ServiceChange>;
  readonly templates: DocumentApi<
    TemplateEntry,
    TemplateDocument,
    TemplateChange
  >;
  readonly preferences: PreferencesApi;
  readonly settings: SettingsApi;
  readonly media: MediaApi;
  readonly library: LibraryApi;
  readonly textImport: TextImportApi;
  readonly powerpoint: PowerPointApi;
  readonly recovery: RecoveryApi;
  readonly locations: LocationsApi;
}

/** Builds `window.llp` on the preload script's port. */
export function llpApi(
  port: IpcPort,
  platform: WindowPlatform,
  custom: {
    readonly bible?: BibleApi;
    readonly update?: UpdateApi;
  } = {},
): LlpApi {
  return {
    update: custom.update ?? updateApi(port),
    bible: custom.bible ?? bibleApi(port),
    app: appApi(port),
    launch: launchApi(port),
    problems: problemsApi(port),
    live: liveApi(port),
    window: windowApi(port),
    ui: uiApi(port, platform),
    log: logApi(port),
    monitors: monitorsApi(port),
    fonts: fontsApi(port),
    output: outputApi(port),
    service: serviceApi(port),
    content: contentApi(port),
    songs: documentApi(port, contentEndpoints.songs),
    services: documentApi(port, contentEndpoints.services),
    templates: documentApi(port, contentEndpoints.templates),
    preferences: preferencesApi(port),
    settings: settingsApi(port),
    media: mediaApi(port, platform),
    library: libraryApi(port),
    textImport: textImportApi(port),
    powerpoint: powerpointApi(port),
    recovery: recoveryApi(port),
    locations: locationsApi(port),
  };
}
