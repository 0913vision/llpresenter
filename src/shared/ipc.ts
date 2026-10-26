import type {LiveCommand} from './commands';
import type {BibleLookupReply, BibleLookupRequest} from './schema/bibleLookup';
import type {AppFlushDone, AppFlushRequest} from './schema/appFlush';
import type {AppProblem} from './schema/appProblem';
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
import type {MonitorList} from './schema/monitors';
import type {OutputStatuses} from './schema/outputStatus';
import type {ShowService} from './schema/showService';
import type {
  ShowLibrarySong,
  ShowLibrarySongRequest,
} from './schema/showLibrarySong';
import type {ServiceOpenRequest} from './schema/serviceOpen';
import type {LayoutChange, MediaStripChange, UiState} from './schema/uiState';
import type {Preferences} from './schema/preferences';
import type {
  SettingsDocument,
  SettingsEdit,
  SettingsReadRequest,
} from './schema/settingsDocuments';
import type {
  MediaDocument,
  MediaEdit,
  MediaEditResult,
  MediaImportRequest,
  MediaImportResult,
  MediaImportProgress,
} from './schema/mediaEdit';
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
import type {
  RecoveryApply,
  RecoveryResult,
  RecoverySummary,
} from './schema/recovery';
import type {MediaId} from './schema/ids';
import type {MissingMedia} from './schema/mediaFiles';

export const Channels = {
  bibleLookup: 'bible:lookup',
  appFlushRequest: 'app:flush-request',
  appFlushDone: 'app:flush-done',
  appCloseAnyway: 'app:close-anyway',
  appProblem: 'app:problem',
  appProblemList: 'app:problem:list',
  appProblemRetrySaves: 'app:problem:retry-saves',
  liveGet: 'live:get',
  liveCommand: 'live:command',
  liveChanged: 'live:changed',
  windowControl: 'window:control',
  uiGet: 'ui:get',
  uiLayoutSet: 'ui:layout:set',
  uiMediaStripSet: 'ui:media-strip:set',
  uiZoomGet: 'ui:zoom:get',
  uiZoomChange: 'ui:zoom:change',
  logWrite: 'log:write',
  outputFrameRate: 'output:frame-rate',
  serviceGet: 'service:get',
  serviceOpen: 'service:open',
  serviceChanged: 'service:changed',
  outputStatusGet: 'output:status:get',
  outputStatusChanged: 'output:status:changed',
  outputRetry: 'output:retry',
  outputFindMonitors: 'output:find-monitors',
  monitorsGet: 'monitors:get',
  monitorsChanged: 'monitors:changed',
  outputShowWindow: 'output:show-window',
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
  libraryShowSong: 'library:show-song',
  textImportRead: 'import:text:read',
  textImportPreview: 'import:text:preview',
  preferencesGet: 'preferences:get',
  preferencesChanged: 'preferences:changed',
  settingsGet: 'settings:get',
  settingsEdit: 'settings:edit',
  settingsChanged: 'settings:changed',
  mediaGet: 'media:get',
  mediaEdit: 'media:edit',
  mediaChanged: 'media:changed',
  mediaImport: 'media:import',
  mediaImportChanged: 'media:import:changed',
  mediaMissing: 'media:missing',
  mediaMissingGet: 'media:missing:get',
  mediaCheck: 'media:check',
  recoverySummary: 'recovery:summary',
  recoveryApply: 'recovery:apply',
  recoveryStartFresh: 'recovery:start-fresh',
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
  readonly bible: {
    /** Resolves offline text and book suggestions without changing live output. */
    lookup(request: BibleLookupRequest): Promise<BibleLookupReply>;
  };
  readonly app: {
    /** Returns a function that removes the control window's flush listener. */
    subscribeFlushRequests(
      listener: (request: AppFlushRequest) => void,
    ): Unsubscribe;
    /** Replies with the editor's flush result for one request. */
    flushDone(reply: AppFlushDone): void;
    /**
     * 강제로 닫기: closes the control window without waiting for its flush, or
     * without another one after main kept it open for a refusal. Main ignores
     * it at any other time.
     */
    closeAnyway(): void;
  };
  readonly problems: {
    /**
     * Reads what a window that loads late must show: the standing problems,
     * such as files skipped at startup, then, once, the newest one-shot
     * problems that no window has read yet (at most 16), such as a
     * `macro-dropped` from a startup 매크로. The read clears those, so
     * subscribe first and then list, and nothing falls between the two.
     * Rejects, after logging, when the call fails or the answer is malformed.
     */
    list(): Promise<readonly AppProblem[]>;
    /**
     * Calls the listener for each problem main reports for a notification
     * card, such as 매크로 적용 실패.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (problem: AppProblem) => void): Unsubscribe;
    /**
     * 다시 시도 of 저장할 수 없음: writes every waiting file again at once. A
     * later push says how it went.
     */
    retrySaves(): void;
  };
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
     * thumbnail scale percentage, or sidebar state.
     */
    setLayout(change: LayoutChange): void;
    /** Saves the media strip choice through the single app.json writer. */
    setMediaStrip(change: MediaStripChange): void;
    /** Reads the computer-local UI zoom percentage (100 to 200, step 10). */
    getZoom(): Promise<number>;
    /** Reads this window's actual zoom factor synchronously, bounded to 1 to 2. */
    getZoomFactor(): number;
    /** Applies one clamped zoom command in main; rejects after logging on failure. */
    changeZoom(command: UiZoomCommand): Promise<number>;
  };
  readonly log: {
    write(entry: RendererLogEntry): void;
  };
  readonly monitors: {
    /**
     * Reads the connected monitors once. Rejects, after logging, when the call
     * fails or the answer is malformed.
     */
    get(): Promise<MonitorList>;
    /**
     * Calls the listener whenever the monitor list changes, with every
     * monitor.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (monitors: MonitorList) => void): Unsubscribe;
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
    /**
     * 모니터 다시 찾기: reads the monitor list again at once and matches each
     * screen's saved monitor again.
     */
    findMonitors(): void;
    /**
     * 창 보기: brings the screen's output window to the front without taking
     * focus, when it shows as a window.
     */
    showWindow(screenId: string): void;
  };
  readonly service: {
    /**
     * Reads the open 예배 순서 as 진행 shows it, or `null` when none is open.
     * It waits while the main process reads the data at launch. Rejects, after
     * logging, when the call fails or the answer is malformed, so a failed
     * read is never taken for "no 예배 순서".
     */
    get(): Promise<ShowService | null>;
    /** Saves the current service and opens another without changing live output; null means it stayed open. */
    open(request: ServiceOpenRequest): Promise<ShowService | null>;
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
    /**
     * Follows normalized preference changes without replacing the startup read.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (preferences: Preferences) => void): Unsubscribe;
  };
  readonly settings: {
    /** Reads one named settings document with its revision and access. */
    get(request: SettingsReadRequest): Promise<SettingsDocument>;
    /** Updates a whole file against its base revision; media has dedicated edits. */
    edit(edit: SettingsEdit): Promise<EditResult>;
    /**
     * Follows each changed settings document with its new revision.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (document: SettingsDocument) => void): Unsubscribe;
  };
  readonly media: {
    get(): Promise<MediaDocument>;
    edit(edit: MediaEdit): Promise<MediaEditResult>;
    /** Starts copy jobs; an empty success means the file dialog was cancelled. */
    import(request: MediaImportRequest): Promise<MediaImportResult>;
    /**
     * Follows the media list after applied edits, with its revision.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe(listener: (document: MediaDocument) => void): Unsubscribe;
    /**
     * Follows one copy job's progress, including failure and cancellation.
     * @returns A function that removes the listener. Always call it.
     */
    subscribeImports(
      listener: (progress: MediaImportProgress) => void,
    ): Unsubscribe;
    /**
     * Reads the media whose file main can't find now. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    missing(): Promise<MissingMedia>;
    /**
     * Follows that set as main checks the files again.
     * @returns A function that removes the listener. Always call it.
     */
    subscribeMissing(listener: (missing: MissingMedia) => void): Unsubscribe;
    /** Asks main to check one media file again, as after it failed to play. */
    check(mediaId: MediaId): void;
  };
  readonly library: {
    /** Searches main's index; rejects and logs malformed requests or replies. */
    search(request: LibrarySearchRequest): Promise<LibrarySearchResult>;
    showSong(request: ShowLibrarySongRequest): Promise<ShowLibrarySong | null>;
  };
  readonly textImport: {
    /** Reads decoded text; a null success means the file dialog was cancelled. */
    read(request: TextImportReadRequest): Promise<TextImportReadResult>;
    /** Rebuilds an unsaved draft from retained text and options; never saves. */
    preview(
      request: TextImportPreviewRequest,
    ): Promise<TextImportPreviewResult>;
  };
  readonly recovery: {
    /** Reads eligible restore rows. Null means there is no dialog to show. */
    summary(): Promise<RecoverySummary>;
    /** Restores the checked rows of the offered record without start macros. */
    apply(request: RecoveryApply): Promise<RecoveryResult>;
    /** Discards crash state and follows normal launch preferences and macros. */
    startFresh(): Promise<RecoveryResult>;
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
