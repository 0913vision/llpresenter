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
import {message, request, signal, type IpcPort} from './endpoint';

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close';

export const windowActions: readonly WindowAction[] = [
  'minimize',
  'toggle-maximize',
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

/** The title bar calls. */
export const windowEndpoints = {
  openScreens: signal('window:open-screens'),
  control: message<WindowAction>('window:control', parseWindowAction),
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
    /** Minimizes, maximizes or restores, or closes the calling window. */
    control: port.message(windowEndpoints.control),
    /** Opens or retargets the 순서 편집 window on a song item. */
    openOrderEditor: port.request(windowEndpoints.openOrderEditor),
    /** Opens or retargets the 곡 편집 window on a song. */
    openSongEditor: port.request(windowEndpoints.openSongEditor),
  };
}

export type WindowApi = ReturnType<typeof windowApi>;
