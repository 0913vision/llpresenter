import type {AudioSource} from '@shared/schema/liveActions';
import type {AudioPlaylist, MediaItem} from '@shared/schema/mediaList';

export interface AudioTrack {
  readonly position: number;
  readonly item: MediaItem | undefined;
  readonly playing: boolean;
  readonly source: AudioSource;
}

export function audioTracks(
  playlist: AudioPlaylist,
  items: readonly MediaItem[],
  active: AudioSource | undefined,
): readonly AudioTrack[] {
  const byId = new Map(
    items.filter(item => item.kind === 'audio').map(item => [item.id, item]),
  );
  return playlist.items.map((id, position) => ({
    position,
    item: byId.get(id),
    playing:
      active?.kind === 'playlist' &&
      active.playlistId === playlist.id &&
      active.position === position,
    source: {kind: 'playlist', playlistId: playlist.id, position},
  }));
}
