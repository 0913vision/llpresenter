import {
  contextBridge,
  ipcRenderer,
  webFrame,
  type IpcRendererEvent,
} from 'electron';
import {
  Channels,
  type DocumentApi,
  type LlpApi,
  type Unsubscribe,
} from '@shared/ipc';
import type {Result} from '@shared/result';
import {
  parseBibleLookupRequest,
  parseBibleLookupReply,
} from '@shared/schema/bibleLookup';
import {
  parseAppFlushDone,
  parseAppFlushRequest,
  parseAppSavePendingResult,
} from '@shared/schema/appFlush';
import {parseAppProblem, parseAppProblems} from '@shared/schema/appProblem';
import {
  parseLibrarySongs,
  parseServiceChange,
  parseServiceDocument,
  parseServiceEntries,
  parseSongChange,
  parseSongDocument,
  parseTemplateChange,
  parseTemplateDocument,
  parseTemplateEntries,
} from '@shared/schema/contentDocuments';
import {parseEditResult} from '@shared/schema/contentEdit';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {parseLiveState} from '@shared/schema/liveState';
import {parseLiveCommandRequest} from '@shared/schema/liveCommand';
import {parseTimerClockReading} from '@shared/schema/timerState';
import {
  parseRecoveryApply,
  parseRecoveryResult,
  parseRecoverySummary,
} from '@shared/schema/recovery';
import type {PayloadError} from '@shared/schema/payload';
import {parseMonitorList} from '@shared/schema/monitors';
import {parseOutputStatuses} from '@shared/schema/outputStatus';
import {parseShowService} from '@shared/schema/showService';
import {
  parseShowLibrarySongRequest,
  parseShowLibrarySongReply,
} from '@shared/schema/showLibrarySong';
import {
  parseServiceOpenRequest,
  parseServiceOpenReply,
} from '@shared/schema/serviceOpen';
import {parseMediaStripChange, parseUiState} from '@shared/schema/uiState';
import {
  parseUiZoomFactor,
  parseUiZoomPercent,
  UI_ZOOM_FACTOR,
} from '@shared/schema/uiZoom';
import {parsePreferencesValue} from '@shared/schema/preferences';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  parseSettingsReadRequest,
  parseSettingsReply,
} from '@shared/schema/settingsDocuments';
import {
  parseMediaDocument,
  parseMediaEdit,
  parseMediaEditResult,
  parseMediaImportRequest,
  parseMediaImportResult,
  parseMediaImportProgress,
} from '@shared/schema/mediaEdit';
import {
  parseMediaCheckRequest,
  parseMediaRevealRequest,
  parseMissingMedia,
} from '@shared/schema/mediaFiles';
import {
  parseLibrarySearchRequest,
  parseLibrarySearchResult,
} from '@shared/schema/librarySearch';
import {
  parseTextImportReadRequest,
  parseTextImportReadResult,
  parseTextImportPreviewRequest,
  parseTextImportPreviewResult,
} from '@shared/schema/textImport';

type Parse<T> = (value: unknown) => Result<T, PayloadError>;

function listen<T>(
  channel: string,
  parse: Parse<T>,
  listener: (value: T) => void,
): Unsubscribe {
  const handler = (_event: IpcRendererEvent, value: unknown): void => {
    const parsed = parse(value);
    if (parsed.ok) {
      listener(parsed.value);
    } else {
      logBadValue('reply', channel, parsed.error);
    }
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// NOTE(0913vision): A failed call or a malformed reply is logged and rejects,
// so a window never takes a failed read for a real answer, such as "no 예배
// 순서" or an empty live state, and keeps what it shows until a push.
async function invokeChecked<T>(
  channel: string,
  parse: Parse<T>,
  ...args: readonly unknown[]
): Promise<T> {
  const reply = await invokeSafely(channel, args);
  const parsed = reply.ok ? parse(reply.value) : reply;
  if (parsed.ok) {
    return parsed.value;
  }
  logBadValue('reply', channel, parsed.error);
  throw new Error(`Bad reply on ${channel}: ${describe(parsed.error)}`);
}

async function invokeSafely(
  channel: string,
  args: readonly unknown[],
): Promise<Result<unknown, PayloadError>> {
  try {
    const value: unknown = await ipcRenderer.invoke(channel, ...args);
    return {ok: true, value};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {ok: false, error: {field: '', message}};
  }
}

function logBadValue(
  kind: 'request' | 'reply',
  channel: string,
  error: PayloadError,
): void {
  ipcRenderer.send(Channels.logWrite, {
    level: 'error',
    message: `Ignored a bad ${kind} on ${channel}`,
    detail: describe(error).slice(0, RENDERER_LOG_LIMITS.detail),
  });
}

interface RequestChannel<TRequest, TReply> {
  readonly channel: string;
  readonly request: Parse<TRequest>;
  readonly reply: Parse<TReply>;
}

async function invokeRequest<TRequest, TReply>(
  {channel, request: parseRequest, reply}: RequestChannel<TRequest, TReply>,
  value: TRequest,
): Promise<TReply> {
  const parsed = parseRequest(value);
  if (!parsed.ok) {
    logBadValue('request', channel, parsed.error);
    throw new Error(`Bad request on ${channel}: ${describe(parsed.error)}`);
  }
  return invokeChecked(channel, reply, parsed.value);
}

function describe({field, message}: PayloadError): string {
  return field === '' ? message : `${field}: ${message}`;
}

function currentZoomFactor(): number {
  let parsed: Result<number, PayloadError>;
  try {
    parsed = parseUiZoomFactor(webFrame.getZoomFactor());
  } catch (cause) {
    parsed = {
      ok: false,
      error: {
        field: '',
        message: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
  if (parsed.ok) return parsed.value;
  logBadValue('reply', 'webFrame.getZoomFactor', parsed.error);
  return UI_ZOOM_FACTOR.default;
}

interface DocumentChannels<TEntry, TDocument, TChange> {
  readonly list: string;
  readonly listChanged: string;
  readonly get: string;
  readonly changed: string;
  readonly parseList: Parse<readonly TEntry[]>;
  readonly parseDocument: Parse<TDocument | null>;
  readonly parseChange: Parse<TChange>;
}

function documentApi<TEntry, TDocument, TChange>(
  channels: DocumentChannels<TEntry, TDocument, TChange>,
): DocumentApi<TEntry, TDocument, TChange> {
  return {
    list: () => invokeChecked(channels.list, channels.parseList),
    get: id => invokeChecked(channels.get, channels.parseDocument, id),
    subscribeList: listener =>
      listen(channels.listChanged, channels.parseList, listener),
    subscribe: listener =>
      listen(channels.changed, channels.parseChange, listener),
  };
}

const api: LlpApi = {
  app: {
    savePending: () =>
      invokeChecked(Channels.appSavePending, parseAppSavePendingResult),
    flushProgress: request => {
      const parsed = parseAppFlushRequest(request);
      if (!parsed.ok) {
        logBadValue('request', Channels.appFlushProgress, parsed.error);
        return;
      }
      ipcRenderer.send(Channels.appFlushProgress, parsed.value);
    },
    subscribeFlushRequests: listener =>
      listen(Channels.appFlushRequest, parseAppFlushRequest, listener),
    flushDone: reply => {
      const parsed = parseAppFlushDone(reply);
      if (!parsed.ok) {
        logBadValue('request', Channels.appFlushDone, parsed.error);
        return;
      }
      ipcRenderer.send(Channels.appFlushDone, parsed.value);
    },
    closeAnyway: () => {
      ipcRenderer.send(Channels.appCloseAnyway);
    },
  },
  problems: {
    list: () => invokeChecked(Channels.appProblemList, parseAppProblems),
    subscribe: listener =>
      listen(Channels.appProblem, parseAppProblem, listener),
    retrySaves: () => {
      ipcRenderer.send(Channels.appProblemRetrySaves);
    },
  },
  live: {
    get: () => invokeChecked(Channels.liveGet, parseLiveState),
    clock: () => invokeChecked(Channels.liveClock, parseTimerClockReading),
    send: command => {
      const parsed = parseLiveCommandRequest(command);
      if (!parsed.ok) {
        logBadValue('request', Channels.liveCommand, parsed.error);
        return;
      }
      for (const error of parsed.value.rejected) {
        logBadValue('request', Channels.liveCommand, error);
      }
      ipcRenderer.send(Channels.liveCommand, parsed.value.command);
    },
    subscribe: listener =>
      listen(Channels.liveChanged, parseLiveState, listener),
  },
  window: {
    control: action => ipcRenderer.send(Channels.windowControl, action),
  },
  ui: {
    get: () => invokeChecked(Channels.uiGet, parseUiState),
    setLayout: change => ipcRenderer.send(Channels.uiLayoutSet, change),
    setMediaStrip: change => {
      const parsed = parseMediaStripChange(change);
      if (!parsed.ok) {
        logBadValue('request', Channels.uiMediaStripSet, parsed.error);
        return;
      }
      ipcRenderer.send(Channels.uiMediaStripSet, parsed.value);
    },
    getZoom: () => invokeChecked(Channels.uiZoomGet, parseUiZoomPercent),
    getZoomFactor: currentZoomFactor,
    changeZoom: command =>
      invokeChecked(Channels.uiZoomChange, parseUiZoomPercent, command),
  },
  log: {
    write: entry => ipcRenderer.send(Channels.logWrite, entry),
  },
  monitors: {
    get: () => invokeChecked(Channels.monitorsGet, parseMonitorList),
    subscribe: listener =>
      listen(Channels.monitorsChanged, parseMonitorList, listener),
  },
  output: {
    reportFrameRate: report =>
      ipcRenderer.send(Channels.outputFrameRate, report),
    getStatus: () =>
      invokeChecked(Channels.outputStatusGet, parseOutputStatuses),
    subscribeStatus: listener =>
      listen(Channels.outputStatusChanged, parseOutputStatuses, listener),
    retry: screenId => ipcRenderer.send(Channels.outputRetry, {screenId}),
    findMonitors: () => ipcRenderer.send(Channels.outputFindMonitors),
    showWindow: screenId =>
      ipcRenderer.send(Channels.outputShowWindow, {screenId}),
  },
  service: {
    get: () => invokeChecked(Channels.serviceGet, parseShowService),
    open: request =>
      invokeRequest(
        {
          channel: Channels.serviceOpen,
          request: parseServiceOpenRequest,
          reply: value => parseServiceOpenReply(request.serviceId, value),
        },
        request,
      ),
    subscribe: listener =>
      listen(Channels.serviceChanged, parseShowService, listener),
  },
  content: {
    edit: edit => invokeChecked(Channels.contentEdit, parseEditResult, edit),
  },
  songs: documentApi({
    list: Channels.songsList,
    listChanged: Channels.songsListChanged,
    get: Channels.songsDocumentGet,
    changed: Channels.songsDocumentChanged,
    parseList: parseLibrarySongs,
    parseDocument: parseSongDocument,
    parseChange: parseSongChange,
  }),
  services: documentApi({
    list: Channels.servicesList,
    listChanged: Channels.servicesListChanged,
    get: Channels.servicesDocumentGet,
    changed: Channels.servicesDocumentChanged,
    parseList: parseServiceEntries,
    parseDocument: parseServiceDocument,
    parseChange: parseServiceChange,
  }),
  templates: documentApi({
    list: Channels.templatesList,
    listChanged: Channels.templatesListChanged,
    get: Channels.templatesDocumentGet,
    changed: Channels.templatesDocumentChanged,
    parseList: parseTemplateEntries,
    parseDocument: parseTemplateDocument,
    parseChange: parseTemplateChange,
  }),
  preferences: {
    get: () => invokeChecked(Channels.preferencesGet, parsePreferencesValue),
    subscribe: listener =>
      listen(Channels.preferencesChanged, parsePreferencesValue, listener),
  },
  settings: {
    get: request =>
      invokeRequest(
        {
          channel: Channels.settingsGet,
          request: parseSettingsReadRequest,
          reply: value => parseSettingsReply(request.name, value),
        },
        request,
      ),
    edit: edit =>
      invokeRequest(
        {
          channel: Channels.settingsEdit,
          request: parseSettingsEdit,
          reply: parseEditResult,
        },
        edit,
      ),
    subscribe: listener =>
      listen(Channels.settingsChanged, parseSettingsDocument, listener),
  },
  media: {
    get: () => invokeChecked(Channels.mediaGet, parseMediaDocument),
    edit: edit =>
      invokeRequest(
        {
          channel: Channels.mediaEdit,
          request: parseMediaEdit,
          reply: parseMediaEditResult,
        },
        edit,
      ),
    import: request =>
      invokeRequest(
        {
          channel: Channels.mediaImport,
          request: parseMediaImportRequest,
          reply: parseMediaImportResult,
        },
        request,
      ),
    subscribe: listener =>
      listen(Channels.mediaChanged, parseMediaDocument, listener),
    subscribeImports: listener =>
      listen(Channels.mediaImportChanged, parseMediaImportProgress, listener),
    missing: () => invokeChecked(Channels.mediaMissingGet, parseMissingMedia),
    subscribeMissing: listener =>
      listen(Channels.mediaMissing, parseMissingMedia, listener),
    check: mediaId => {
      const parsed = parseMediaCheckRequest({mediaId});
      if (!parsed.ok) {
        logBadValue('request', Channels.mediaCheck, parsed.error);
        return;
      }
      ipcRenderer.send(Channels.mediaCheck, parsed.value);
    },
    reveal: mediaId => {
      const parsed = parseMediaRevealRequest({mediaId});
      if (!parsed.ok) {
        logBadValue('request', Channels.mediaReveal, parsed.error);
        return;
      }
      ipcRenderer.send(Channels.mediaReveal, parsed.value);
    },
  },
  library: {
    showSong: request =>
      invokeRequest(
        {
          channel: Channels.libraryShowSong,
          request: parseShowLibrarySongRequest,
          reply: value => parseShowLibrarySongReply(request.songId, value),
        },
        request,
      ),
    search: request =>
      invokeRequest(
        {
          channel: Channels.librarySearch,
          request: parseLibrarySearchRequest,
          reply: parseLibrarySearchResult,
        },
        request,
      ),
  },
  textImport: {
    read: request =>
      invokeRequest(
        {
          channel: Channels.textImportRead,
          request: parseTextImportReadRequest,
          reply: parseTextImportReadResult,
        },
        request,
      ),
    preview: request =>
      invokeRequest(
        {
          channel: Channels.textImportPreview,
          request: parseTextImportPreviewRequest,
          reply: parseTextImportPreviewResult,
        },
        request,
      ),
  },
  bible: {
    lookup: request =>
      invokeRequest(
        {
          channel: Channels.bibleLookup,
          request: parseBibleLookupRequest,
          reply: value => parseBibleLookupReply(request, value),
        },
        request,
      ),
  },
  recovery: {
    summary: () =>
      invokeChecked(Channels.recoverySummary, parseRecoverySummary),
    apply: request =>
      invokeRequest(
        {
          channel: Channels.recoveryApply,
          request: parseRecoveryApply,
          reply: parseRecoveryResult,
        },
        request,
      ),
    startFresh: () =>
      invokeChecked(Channels.recoveryStartFresh, parseRecoveryResult),
  },
};

contextBridge.exposeInMainWorld('llp', api);
