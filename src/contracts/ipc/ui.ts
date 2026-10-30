import {
  parseMediaBrowserChange,
  type MediaBrowserChange,
} from '@core/schema/mediaBrowser';
import {
  parseLayoutChange,
  parseMediaStripChange,
  parsePrepMediaChange,
  parseUiState,
  type LayoutChange,
  type MediaStripChange,
  type PrepMediaChange,
  type UiState,
} from '@core/schema/uiState';
import {
  parseUiZoomCommand,
  parseUiZoomPercent,
  type UiZoomCommand,
} from '@core/schema/uiZoom';
import {
  message,
  query,
  request,
  type IpcPort,
  type WindowPlatform,
} from './endpoint';

/** The calls that read and save the control window's UI state and zoom. */
export const uiEndpoints = {
  get: query<UiState>('ui:get', parseUiState),
  setLayout: message<LayoutChange>('ui:layout:set', parseLayoutChange),
  setMediaStrip: message<MediaStripChange>(
    'ui:media-strip:set',
    parseMediaStripChange,
  ),
  setPrepMedia: message<PrepMediaChange>(
    'ui:prep-media:set',
    parsePrepMediaChange,
  ),
  setMediaBrowser: message<MediaBrowserChange>(
    'ui:media-browser:set',
    parseMediaBrowserChange,
  ),
  getZoom: query<number>('ui:zoom:get', parseUiZoomPercent),
  changeZoom: request<UiZoomCommand, number>('ui:zoom:change', {
    request: parseUiZoomCommand,
    reply: parseUiZoomPercent,
  }),
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
    /** Saves the media strip choice through the single app.json writer. */
    setMediaStrip: port.message(uiEndpoints.setMediaStrip),
    /** Saves 준비's media mode independently of 진행's media strip. */
    setPrepMedia: port.message(uiEndpoints.setPrepMedia),
    /** Changes only the supplied media browser fields through app.json. */
    setMediaBrowser: port.message(uiEndpoints.setMediaBrowser),
    /** Reads the computer-local UI zoom percentage (100 to 200, step 10). */
    getZoom: port.query(uiEndpoints.getZoom),
    /** Reads this window's actual zoom factor synchronously, bounded to 1 to 2. */
    getZoomFactor: (): number => platform.zoomFactor(),
    /** Applies one clamped zoom command in main; rejects after logging on failure. */
    changeZoom: port.request(uiEndpoints.changeZoom),
  };
}

export type UiApi = ReturnType<typeof uiApi>;
