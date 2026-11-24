import {
  parseLayoutChange,
  parseUiState,
  parseRememberedViewChange,
  type RememberedViewChange,
  type LayoutChange,
  type UiState,
} from '@core/schema/app/uiState';
import {
  parseUiZoomCommand,
  parseUiZoomPercent,
  type UiZoomCommand,
} from '@core/schema/app/uiZoom';
import {
  message,
  push,
  query,
  request,
  type IpcPort,
  type WindowPlatform,
} from './endpoint';

/** The calls that read and save the control window's UI state and zoom. */
export const uiEndpoints = {
  get: query<UiState>('ui:get', parseUiState),
  setLayout: message<LayoutChange>('ui:layout:set', parseLayoutChange),
  setRememberedView: message<RememberedViewChange>(
    'ui:remembered-view:set',
    parseRememberedViewChange,
  ),
  getZoom: query<number>('ui:zoom:get', parseUiZoomPercent),
  changeZoom: request<UiZoomCommand, number>('ui:zoom:set', {
    request: parseUiZoomCommand,
    reply: parseUiZoomPercent,
  }),
  zoomChanged: push<number>('ui:zoom:changed', parseUiZoomPercent),
};

/** The UI state part of `window.llp`. */
export function uiApi(port: IpcPort, platform: WindowPlatform) {
  return {
    /**
     * Reads the UI state once, before the first render. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    get: port.query(uiEndpoints.get),
    /**
     * Saves a size class's layout: the column widths when a drag ends, or the
     * thumbnail scale percentage, or sidebar state.
     */
    setLayout: port.message(uiEndpoints.setLayout),
    /**
     * Remembers how views were left: the media strip, the media browser's
     * fields that are given, the big preview, the tool tab, the 매크로 view
     * and 모음, and the slide columns.
     */
    setRememberedView: port.message(uiEndpoints.setRememberedView),
    /** Reads the computer-local UI zoom percentage (100 to 200, step 10). */
    getZoom: port.query(uiEndpoints.getZoom),
    /** Reads this window's actual zoom factor synchronously, bounded to 1 to 2. */
    getZoomFactor: (): number => platform.zoomFactor(),
    /** Applies one clamped zoom command in main; rejects after logging on failure. */
    changeZoom: port.request(uiEndpoints.changeZoom),
    /** Follows the zoom percentage when any window changes it. */
    onZoomChanged: port.subscribe(uiEndpoints.zoomChanged),
  };
}

export type UiApi = ReturnType<typeof uiApi>;
