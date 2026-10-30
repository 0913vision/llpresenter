import {appApi, problemsApi, type AppApi, type ProblemsApi} from './app';
import {bibleApi, type BibleApi} from './bible';
import {
  contentApi,
  contentEndpoints,
  documentApi,
  type ContentApi,
  type DocumentApi,
} from './content';
import type {IpcPort, WindowPlatform} from './endpoint';
import {
  libraryApi,
  textImportApi,
  type LibraryApi,
  type TextImportApi,
} from './library';
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
} from '@core/schema/contentDocuments';

export {Channels} from './channels';
export type {DocumentApi} from './content';
export type {Unsubscribe} from './endpoint';
export {windowActions, type WindowAction} from './window';

/**
 * The API that the preload script exposes to windows as `window.llp`. Each
 * part is declared with its calls in its own file in this folder.
 */
export interface LlpApi {
  readonly bible: BibleApi;
  readonly app: AppApi;
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
  readonly recovery: RecoveryApi;
}

/** Builds `window.llp` on the preload script's port. */
export function llpApi(port: IpcPort, platform: WindowPlatform): LlpApi {
  return {
    bible: bibleApi(port),
    app: appApi(port),
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
    recovery: recoveryApi(port),
  };
}
