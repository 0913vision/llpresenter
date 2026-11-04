import type {Preferences} from '../schema/preferences';
import type {MediaItem} from '../schema/mediaList';

/** The 새 미디어 defaults of 환경설정 (spec 02, `media.defaults`). */
export type MediaDefaults = Preferences['media']['defaults'];

/**
 * The playback properties a new import starts with. A video always carries its
 * sound choice; 끝나면 and 맞춤 are written only when they differ from what a
 * media without them already does (반복, 채우기), so a file stays as small as
 * before when the defaults are not changed. An image takes only 맞춤, and an
 * audio file takes none.
 *
 * NOTE: leaving `end` and `fit` out means 반복 and 채우기 only because
 * `mediaLoops` (mediaEndRule.ts) and the output media (schema/outputMedia.ts,
 * objectFit.ts) read a missing value that way. Change them together.
 */
export function importedProps(
  kind: MediaItem['kind'],
  defaults: MediaDefaults,
): MediaItem['props'] {
  if (kind === 'audio') return undefined;
  const fit = defaults.fit === 'fill' ? {} : {fit: defaults.fit};
  if (kind === 'image') return 'fit' in fit ? fit : undefined;
  return {
    audio: defaults.audio,
    ...(defaults.end === 'loop' ? {} : {end: defaults.end}),
    ...fit,
  };
}
