import type {AudioPlaylist} from '@core/schema/media/mediaList';

/**
 * The 재생 / 일시 정지 press for buttons and keys: main pauses what plays,
 * plays on what is held, and with nothing playing starts `selected` from its
 * first track when one of its tracks can play. Main decides from where it has
 * the audio, so a press made before the window hears the one before counts.
 */
export function audioPlayCommand({
  selected,
  playable,
}: {
  readonly selected: AudioPlaylist | undefined;
  /** Whether a track of `selected` can play; main skips the ones that can't. */
  readonly playable: boolean;
}) {
  return selected !== undefined && selected.items.length > 0 && playable
    ? {
        type: 'audio.toggle' as const,
        source: {
          kind: 'playlist' as const,
          playlistId: selected.id,
          position: 0,
        },
      }
    : {type: 'audio.toggle' as const};
}
