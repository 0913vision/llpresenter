import type {OpenWindowResult} from '@core/schema/ipcPayloads';
import type {ServiceId, ServiceItemId, SongId} from '@core/schema/ids';

export interface SongEditorTarget {
  readonly songId: SongId;
  readonly block?: number | undefined;
  readonly action?: 'hot-key' | undefined;
  readonly from?:
    {readonly serviceId: ServiceId; readonly itemId: ServiceItemId} | undefined;
  readonly focusTitle?: boolean | undefined;
}

let latest: SongEditorTarget | null = null;
const listeners = new Set<(target: SongEditorTarget) => void>();

/** Opens a song in the control workspace without a round trip through main. */
export function requestSongEditor(
  target: SongEditorTarget,
): Promise<OpenWindowResult> {
  if (listeners.size === 0) latest = target;
  else {
    latest = null;
    for (const listener of listeners) listener(target);
  }
  return Promise.resolve({ok: true, value: undefined});
}

/** Follows requests made in this renderer, including one made before mounting. */
export function subscribeSongEditor(
  listener: (target: SongEditorTarget) => void,
): () => void {
  listeners.add(listener);
  const pending = latest;
  latest = null;
  if (pending !== null) listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
