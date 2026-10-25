import type {LiveCommand} from './commands';
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
} from './schema/contentDocuments';
import type {ContentEdit, EditResult} from './schema/contentEdit';
import type {LiveState} from './live';
import type {FrameRateReport, RendererLogEntry} from './schema/ipcPayloads';
import type {OutputStatuses} from './schema/outputStatus';
import type {ShowService} from './schema/showService';
import type {LayoutChange, UiState} from './schema/uiState';
import type {Preferences} from './schema/preferences';
import type {
  LibrarySearchRequest,
  LibrarySearchResult,
} from './schema/librarySearch';
import type {
  TextImportReadRequest,
  TextImportReadResult,
  TextImportPreviewRequest,
  TextImportPreviewResult,
} from './schema/textImport';
import type {UiZoomCommand} from './schema/uiZoom';

export const Channels = {
  liveGet: 'live:get',
  liveCommand: 'live:command',
  liveChanged: 'live:changed',
  windowControl: 'window:control',
  uiGet: 'ui:get',
  uiLayoutSet: 'ui:layout:set',
  uiZoomGet: 'ui:zoom:get',
  uiZoomChange: 'ui:zoom:change',
  logWrite: 'log:write',
  outputFrameRate: 'output:frame-rate',
  serviceGet: 'service:get',
  serviceChanged: 'service:changed',
  outputStatusGet: 'output:status:get',
  outputStatusChanged: 'output:status:changed',
  outputRetry: 'output:retry',
  contentEdit: 'content:edit',
  songsList: 'songs:list',
  songsListChanged: 'songs:list:changed',
  songsDocumentGet: 'songs:document:get',
  songsDocumentChanged: 'songs:document:changed',
  servicesList: 'services:list',
  servicesListChanged: 'services:list:changed',
  servicesDocumentGet: 'services:document:get',
  servicesDocumentChanged: 'services:document:changed',
  templatesList: 'templates:list',
  templatesListChanged: 'templates:list:changed',
  templatesDocumentGet: 'templates:document:get',
  templatesDocumentChanged: 'templates:document:changed',
  librarySearch: 'library:search',
  textImportRead: 'import:text:read',
  textImportPreview: 'import:text:preview',
  preferencesGet: 'preferences:get',
} as const;

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close';

export const windowActions: readonly WindowAction[] = [
  'minimize',
  'toggle-maximize',
  'close',
];

export type Unsubscribe = () => void;

/** The API that the preload script exposes to windows as `window.llp`. */
export interface LlpApi {
  readonly live: {
    /**
     * Reads the live state once. Rejects, after logging, when the call fails or
     * the answer is malformed; a push brings the state later.
     */
    get(): Promise<LiveState>;
    send(command: LiveCommand): void;
    /**
     * Calls the listener on every state change.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (state: LiveState) => void): Unsubscribe;
  };
  readonly window: {
    control(action: WindowAction): void;
  };
  readonly ui: {
    /**
     * Reads the UI state once, before the first render. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    get(): Promise<UiState>;
    /**
     * Saves a size class's layout: the column widths when a drag ends, or the
     * thumbnail scale percentage when the size control commits.
     */
    setLayout(change: LayoutChange): void;
    /** Reads the computer-local UI zoom percentage (100 to 200, step 10). */
    getZoom(): Promise<number>;
    /** Applies one clamped zoom command in main; rejects after logging on failure. */
    changeZoom(command: UiZoomCommand): Promise<number>;
  };
  readonly log: {
    write(entry: RendererLogEntry): void;
  };
  readonly output: {
    /** Reports an output window's measured frame rate, once a second. */
    reportFrameRate(report: FrameRateReport): void;
    /**
     * Reads the status of every screen's output once. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    getStatus(): Promise<OutputStatuses>;
    /**
     * Calls the listener whenever a screen's output status changes, with
     * every screen's status.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribeStatus(listener: (statuses: OutputStatuses) => void): Unsubscribe;
    /**
     * 다시 시도: tries the screen's output window again at once while the
     * restart limit holds.
     */
    retry(screenId: string): void;
  };
  readonly service: {
    /**
     * Reads the open 예배 순서 as 진행 shows it, or `null` when none is open.
     * It waits while the main process reads the data at launch. Rejects, after
     * logging, when the call fails or the answer is malformed, so a failed
     * read is never taken for "no 예배 순서".
     */
    get(): Promise<ShowService | null>;
    /**
     * Calls the listener when the open 예배 순서 changes, or another one opens.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (service: ShowService | null) => void): Unsubscribe;
  };
  readonly content: {
    /**
     * Asks the main process to apply an edit and answers how it went. The
     * window's draft, such as the text being typed, is its own UI state; its
     * copy of the document changes only on this answer or on a push. Rejects,
     * after logging, when the call fails or the answer is malformed.
     */
    edit(edit: ContentEdit): Promise<EditResult>;
  };
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
  readonly preferences: {
    /**
     * Waits for the existing settings load and reads normalized preferences.
     * Rejects and logs a failed call or malformed reply.
     */
    get(): Promise<Preferences>;
  };
  readonly library: {
    /** Searches main's index; rejects and logs malformed requests or replies. */
    search(request: LibrarySearchRequest): Promise<LibrarySearchResult>;
  };
  readonly textImport: {
    /** Reads decoded text; a null success means the file dialog was cancelled. */
    read(request: TextImportReadRequest): Promise<TextImportReadResult>;
    /** Rebuilds an unsaved draft from retained text and options; never saves. */
    preview(
      request: TextImportPreviewRequest,
    ): Promise<TextImportPreviewResult>;
  };
}

/** Reading and following one kind of document: songs, 예배 순서, or 틀. */
export interface DocumentApi<TEntry, TDocument, TChange> {
  /** The list, as the 라이브러리 or the 예배 순서 list shows it. */
  list(): Promise<readonly TEntry[]>;
  /** One document with its revision, or `null` when there is none. */
  get(id: string): Promise<TDocument | null>;
  /**
   * Calls the listener with the whole list whenever an entry is added,
   * removed, or changes what the list shows; typing lyrics doesn't change it.
   *
   * @returns A function that removes the listener. Always call it.
   */
  subscribeList(listener: (entries: readonly TEntry[]) => void): Unsubscribe;
  /**
   * Calls the listener once for every change the main process applies to a
   * document, with its new revision. While someone types, that is as often as
   * the editor sends its updates; a window that shows a document follows only
   * the one it shows and skips the change whose revision answered its own
   * edit.
   *
   * @returns A function that removes the listener. Always call it.
   */
  subscribe(listener: (change: TChange) => void): Unsubscribe;
}
