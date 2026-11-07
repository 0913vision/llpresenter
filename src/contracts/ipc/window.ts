import type {Result} from '@core/common/result';
import {
  parseOpenWindowResult,
  parseOrderEditorTarget,
  parseSongEditorTarget,
  refuseOpenWindow,
  type OpenWindowResult,
  type OrderEditorTarget,
  type SongEditorTarget,
} from '@core/schema/ipcPayloads';
import type {PayloadError} from '@core/schema/payload';
import {
  PREFERENCE_PAGE_IDS,
  type PreferencePageId,
} from '@core/schema/preferencePages';
import {message, push, query, request, signal, type IpcPort} from './endpoint';

export type WindowAction =
  'minimize' | 'toggle-maximize' | 'toggle-full-screen' | 'close';

export const windowActions: readonly WindowAction[] = [
  'minimize',
  'toggle-maximize',
  'toggle-full-screen',
  'close',
];

/** Checks a title bar action. */
export function parseWindowAction(
  value: unknown,
): Result<WindowAction, PayloadError> {
  const action = windowActions.find(known => known === value);
  return action === undefined
    ? {ok: false, error: {field: '', message: 'Unknown window action'}}
    : {ok: true, value: action};
}

export type TextEditAction =
  'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll';

export const textEditActions: readonly TextEditAction[] = [
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
];

/** Checks a text editing action of the 편집 menu. */
export function parseTextEditAction(
  value: unknown,
): Result<TextEditAction, PayloadError> {
  const action = textEditActions.find(known => known === value);
  return action === undefined
    ? {ok: false, error: {field: '', message: 'Unknown text edit action'}}
    : {ok: true, value: action};
}

/** Checks the page a 환경설정 window should show. */
export function parsePreferencePage(
  value: unknown,
): Result<PreferencePageId, PayloadError> {
  const page = PREFERENCE_PAGE_IDS.find(known => known === value);
  return page === undefined
    ? {ok: false, error: {field: '', message: 'Unknown preferences page'}}
    : {ok: true, value: page};
}

export const PREFERENCES_REQUEST_LIMIT = 2_147_483_647;
export interface PreferencesRequest {
  readonly requestId: number;
  readonly page: PreferencePageId;
}

export interface SettingsRequest extends PreferencesRequest {
  readonly view: 'preferences' | 'screens';
  readonly preparing: boolean;
}

/** Checks the bounded route and generation of the shared settings window. */
export function parseSettingsRequest(
  value: unknown,
): Result<SettingsRequest, PayloadError> {
  const parsed = parsePreferencesRequest(value);
  if (!parsed.ok) return parsed;
  if (
    typeof value !== 'object' ||
    value === null ||
    !('view' in value) ||
    (value.view !== 'preferences' && value.view !== 'screens') ||
    !('preparing' in value) ||
    typeof value.preparing !== 'boolean'
  ) {
    return {
      ok: false,
      error: {field: '', message: 'Expected a settings window route'},
    };
  }
  return {
    ok: true,
    value: {...parsed.value, view: value.view, preparing: value.preparing},
  };
}

/** Correlates a rendered preferences page with the request that selected it. */
export function parsePreferencesRequest(
  value: unknown,
): Result<PreferencesRequest, PayloadError> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('requestId' in value) ||
    typeof value.requestId !== 'number' ||
    !Number.isInteger(value.requestId) ||
    value.requestId < 0 ||
    value.requestId > PREFERENCES_REQUEST_LIMIT ||
    !('page' in value)
  ) {
    return {
      ok: false,
      error: {field: '', message: 'Expected a preferences request'},
    };
  }
  const page = parsePreferencePage(value.page);
  return page.ok
    ? {ok: true, value: {requestId: value.requestId, page: page.value}}
    : page;
}

/** What 버전 정보 shows. */
export interface AppInfo {
  readonly name: string;
  readonly version: string;
}

/** Checks the app name and version main reports. */
export function parseAppInfo(value: unknown): Result<AppInfo, PayloadError> {
  if (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'version' in value &&
    typeof value.version === 'string'
  ) {
    return {ok: true, value: {name: value.name, version: value.version}};
  }
  return {ok: false, error: {field: '', message: 'Expected the app info'}};
}

/** Checks the diagnostics text main collects. */
/** The most characters of the diagnostics text; the text main builds is far smaller. */
export const DIAGNOSTICS_TEXT_LIMIT = 20_000;

export function parseDiagnosticsText(
  value: unknown,
): Result<string, PayloadError> {
  return typeof value === 'string' && value.length <= DIAGNOSTICS_TEXT_LIMIT
    ? {ok: true, value}
    : {ok: false, error: {field: '', message: 'Expected the diagnostics text'}};
}

/** Checks a state that is on or off. */
export function parseOnOff(value: unknown): Result<boolean, PayloadError> {
  return typeof value === 'boolean'
    ? {ok: true, value}
    : {ok: false, error: {field: '', message: 'Expected on or off'}};
}

/** The title bar calls. */
export const windowEndpoints = {
  settingsRequest: query<SettingsRequest>(
    'window:settings-request',
    parseSettingsRequest,
  ),
  showSettingsRequest: push<SettingsRequest>(
    'window:show-settings-request',
    parseSettingsRequest,
  ),
  beginSettingsRequest: request<SettingsRequest, boolean>(
    'window:begin-settings-request',
    {request: parseSettingsRequest, reply: parseOnOff, refuse: () => false},
  ),
  rejectSettingsRequest: message<SettingsRequest>(
    'window:reject-settings-request',
    parseSettingsRequest,
  ),
  settingsReady: message<SettingsRequest>(
    'window:settings-ready',
    parseSettingsRequest,
  ),
  openScreens: signal('window:open-screens'),
  openPreferences: signal('window:open-preferences'),
  preferencesReady: message<PreferencesRequest>(
    'window:preferences-ready',
    parsePreferencesRequest,
  ),
  preferencesRequest: query<PreferencesRequest>(
    'window:preferences-request',
    parsePreferencesRequest,
  ),
  openPreferencesAt: message<PreferencePageId>(
    'window:open-preferences-at',
    parsePreferencePage,
  ),
  preferencesPage: query<PreferencePageId | null>(
    'window:preferences-page',
    value =>
      value === null ? {ok: true, value: null} : parsePreferencePage(value),
  ),
  openLogFolder: signal('window:open-log-folder'),
  appInfo: query<AppInfo>('window:app-info', parseAppInfo),
  diagnostics: query<string>('window:diagnostics', parseDiagnosticsText),
  verboseLogging: message<boolean>('window:verbose-logging', parseOnOff),
  verboseLoggingState: query<boolean>('window:verbose-logging:get', parseOnOff),
  showPreferencesPage: push<PreferencePageId>(
    'window:show-preferences-page',
    parsePreferencePage,
  ),
  control: message<WindowAction>('window:control', parseWindowAction),
  fullScreen: query<boolean>('window:full-screen', parseOnOff),
  fullScreenChanged: push<boolean>('window:full-screen:changed', parseOnOff),
  editText: message<TextEditAction>('window:edit-text', parseTextEditAction),
  openOrderEditor: request<OrderEditorTarget, OpenWindowResult>(
    'window:open-order-editor',
    {
      request: parseOrderEditorTarget,
      reply: parseOpenWindowResult,
      refuse: refuseOpenWindow,
    },
  ),
  openSongEditor: request<SongEditorTarget, OpenWindowResult>(
    'window:open-song-editor',
    {
      request: parseSongEditorTarget,
      reply: parseOpenWindowResult,
      refuse: refuseOpenWindow,
    },
  ),
};

/** The title bar part of `window.llp`. */
export function windowApi(port: IpcPort) {
  return {
    /** Reads and follows the latest route of the one settings window. */
    settingsRequest: port.query(windowEndpoints.settingsRequest),
    onSettingsRequest: port.subscribe(windowEndpoints.showSettingsRequest),
    /** Hides and sizes a changing view before its renderer commits it. */
    beginSettingsRequest: port.request(windowEndpoints.beginSettingsRequest),
    rejectSettingsRequest: port.message(windowEndpoints.rejectSettingsRequest),
    settingsReady: port.message(windowEndpoints.settingsReady),
    /** Opens or focuses the screen configuration window. */
    openScreens: port.signal(windowEndpoints.openScreens),
    /** Opens or focuses the 환경설정 window. */
    openPreferences: port.signal(windowEndpoints.openPreferences),
    /** Reveals the preferences window after its content and fonts are drawn. */
    preferencesReady: port.message(windowEndpoints.preferencesReady),
    /** Reads the latest page request and its bounded identity. */
    preferencesRequest: port.query(windowEndpoints.preferencesRequest),
    /** Opens the app's log folder in the file manager. */
    openLogFolder: port.signal(windowEndpoints.openLogFolder),
    /** The text 진단 정보 copies: versions, devices, and recent errors. */
    diagnostics: port.query(windowEndpoints.diagnostics),
    /** Turns 자세한 기록 on or off until the next launch. */
    setVerboseLogging: port.message(windowEndpoints.verboseLogging),
    /** Whether 자세한 기록 is on now; main keeps the state for the launch. */
    verboseLogging: port.query(windowEndpoints.verboseLoggingState),
    /** The app name and version. */
    appInfo: port.query(windowEndpoints.appInfo),
    /** Opens or focuses the 환경설정 window on one of its pages. */
    openPreferencesAt: port.message(windowEndpoints.openPreferencesAt),
    /** The page the 환경설정 window was opened on, or null for the first. */
    preferencesPage: port.query(windowEndpoints.preferencesPage),
    /** Follows the page requests of a 환경설정 window that stays open. */
    onPreferencesPage: port.subscribe(windowEndpoints.showPreferencesPage),
    /** Minimizes, maximizes or restores, or closes the calling window. */
    control: port.message(windowEndpoints.control),
    /** Whether the calling window is full screen. */
    fullScreen: port.query(windowEndpoints.fullScreen),
    /**
     * Follows the calling window as it enters or leaves full screen.
     * @returns A function that removes the listener. Always call it.
     */
    onFullScreen: port.subscribe(windowEndpoints.fullScreenChanged),
    /** Runs a text editing action on the focused field of the calling window. */
    editText: port.message(windowEndpoints.editText),
    /** Opens or retargets the 순서 편집 window on a song item. */
    openOrderEditor: port.request(windowEndpoints.openOrderEditor),
    /** Opens or retargets the 곡 편집 window on a song. */
    openSongEditor: port.request(windowEndpoints.openSongEditor),
  };
}

export type WindowApi = ReturnType<typeof windowApi>;
