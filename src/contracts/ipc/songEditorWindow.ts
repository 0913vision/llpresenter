import {
  parseSongEditorTarget,
  type SongEditorTarget,
} from '@core/schema/ipcPayloads';
import {push, query, type IpcPort} from './endpoint';

/** What the 곡 편집 window shows, and the pushes that move it to another target. */
export const songEditorWindowEndpoints = {
  target: query<SongEditorTarget | null>('song-editor:target', value =>
    value === null ? {ok: true, value: null} : parseSongEditorTarget(value),
  ),
  retarget: push<SongEditorTarget | null>('song-editor:retarget', value =>
    value === null ? {ok: true, value: null} : parseSongEditorTarget(value),
  ),
};

/** The 곡 편집 window part of `window.llp`. */
export function songEditorWindowApi(port: IpcPort) {
  return {
    /** The target this window was opened on, or null when it has none. */
    target: port.query(songEditorWindowEndpoints.target),
    /** Follows the target changes of a window that stays open. */
    onRetarget: port.subscribe(songEditorWindowEndpoints.retarget),
  };
}

export type SongEditorWindowApi = ReturnType<typeof songEditorWindowApi>;
