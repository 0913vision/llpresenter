import type {LlpApi} from '@contracts/ipc/api';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import type {MediaId} from '@core/schema/common/ids';
import type {Notice} from '@renderer/ui/popups/notices';
import type {ChosenPlaylist} from './mediaEntries';

/** The title of the card of a media list that could not be read. */
export const MEDIA_LOAD_FAILED = '미디어 불러오기 실패';

// NOTE(0913vision): The preload rejects a failed call or a malformed reply;
// it is reported like a refusal.
export function rejected(error: unknown): {
  readonly ok: false;
  readonly error: {readonly reason: 'invalid'; readonly message: string};
} {
  const message = error instanceof Error ? error.message : String(error);
  return {ok: false, error: {reason: 'invalid', message}};
}

/** What a media edit answers, or the refusal a failed call is read as. */
export type MediaEditOutcome =
  Awaited<ReturnType<LlpApi['media']['edit']>> | ReturnType<typeof rejected>;

/** A write that main made, also when its file could not be saved. */
export function written(result: MediaEditOutcome): boolean {
  return result.ok || result.error.reason === 'write-failed';
}

/** The id a create or copy made, also when its file was not written. */
export function createdId(result: MediaEditOutcome): string | null {
  if (result.ok) return result.value?.id ?? null;
  return result.error.reason === 'write-failed'
    ? result.error.applied.id
    : null;
}

/** What a refused media edit logs and the notice it shows. */
export interface Refusal {
  readonly log: string;
  readonly notice: Notice;
}

/** What a playlist update changes: its name, its media, or both. */
export interface PlaylistChange {
  readonly name?: string;
  readonly items?: readonly MediaId[];
}

/** The playlist as a media edit names it: its kind and id. */
export function playlistRef(playlist: ChosenPlaylist) {
  return playlist.kind === 'media'
    ? ({kind: 'media', id: playlist.id} as const)
    : ({kind: 'audio', id: playlist.id} as const);
}

/** The playlist with the change, as a media edit writes it; null when it is gone. */
export function playlistUpdate(
  {value}: MediaDocument,
  playlist: ChosenPlaylist,
  change: PlaylistChange,
) {
  if (playlist.kind === 'media') {
    const found = value.playlists.find(({id}) => id === playlist.id);
    return found === undefined
      ? null
      : ({kind: 'media', value: {...found, ...change}} as const);
  }
  const found = value.audioPlaylists.find(({id}) => id === playlist.id);
  return found === undefined
    ? null
    : ({kind: 'audio', value: {...found, ...change}} as const);
}

/**
 * The newest playlist name main took but could not save. Until a later rename
 * is saved, renaming to the same name writes again, and an answer that wrote
 * nothing does not count as saved.
 */
export class UnsavedPlaylistName {
  private revision: number | null = null;

  /** Whether a name main took is not saved yet. */
  get pending(): boolean {
    return this.revision !== null;
  }

  /**
   * Follows main's answer to a rename written on revision `base`.
   *
   * @returns Whether the rename counts as done so far.
   */
  follow(result: MediaEditOutcome, base: number): boolean {
    if (!result.ok) {
      const taken =
        result.error.reason === 'write-failed'
          ? (result.error.applied.revision ?? base)
          : base;
      this.revision = Math.max(this.revision ?? 0, taken);
      return true;
    }
    if (result.value === null) return this.revision === null;
    if (
      this.revision !== null &&
      (result.value.revision ?? base) >= this.revision
    ) {
      this.revision = null;
    }
    return true;
  }
}
