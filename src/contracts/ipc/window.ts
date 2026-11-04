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
  openScreens: signal('window:open-screens'),
  openPreferences: signal('window:open-preferences'),
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
    /** Opens or focuses the screen configuration window. */
    openScreens: port.signal(windowEndpoints.openScreens),
    /** Opens or focuses the 환경설정 window. */
    openPreferences: port.signal(windowEndpoints.openPreferences),
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
