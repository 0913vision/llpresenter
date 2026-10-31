import type {AudioLayer} from '../live/state';
import type {AudioPlaylist} from '../schema/mediaList';

/** Resolves the same pause, resume, or playlist start for buttons and bindings. */
export function audioPlayCommand({
  audio,
  selected,
  firstPlayable,
}: {
  readonly audio: AudioLayer | null;
  readonly selected: AudioPlaylist | undefined;
  readonly firstPlayable: boolean;
}) {
  if (audio?.playback) {
    return {
      type:
        audio.playback.since !== null
          ? ('audio.pause' as const)
          : ('audio.play' as const),
    };
  }
  if (selected !== undefined && selected.items.length > 0 && firstPlayable) {
    return {
      type: 'audio.play' as const,
      source: {kind: 'playlist' as const, playlistId: selected.id, position: 0},
    };
  }
  return null;
}
