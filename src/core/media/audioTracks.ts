import type {AudioSource} from '@core/schema/live/liveActions';
import type {AudioPlaylist, MediaItem} from '@core/schema/media/mediaList';

/**
 * One row of an audio playlist: its place, its media item, whether it is
 * playing, and the source it plays from.
 */
export interface AudioTrack {
  readonly position: number;
  readonly item: MediaItem | undefined;
  readonly playing: boolean;
  readonly source: AudioSource;
  readonly missing: boolean;
}

/** What the rows of a playlist are marked by: the playing track, and missing files. */
export interface AudioTrackMarks {
  readonly active?: AudioSource | undefined;
  readonly missingFiles?: ReadonlySet<string> | undefined;
}

/**
 * The rows of a playlist. A row whose audio item is gone has no `item` and is
 * marked missing, as is one whose file is in `missingFiles`.
 */
export function audioTracks(
  playlist: AudioPlaylist,
  items: readonly MediaItem[],
  {active, missingFiles}: AudioTrackMarks = {},
): readonly AudioTrack[] {
  const byId = new Map(
    items.filter(item => item.kind === 'audio').map(item => [item.id, item]),
  );
  return playlist.items.map((id, position) => ({
    position,
    item: byId.get(id),
    missing: !byId.has(id) || missingFiles?.has(id) === true,
    playing:
      active?.kind === 'playlist' &&
      active.playlistId === playlist.id &&
      active.position === position,
    source: {kind: 'playlist', playlistId: playlist.id, position},
  }));
}
