import type {Song} from './schema/song';

/** Playback uses file order when the named order is missing or empty (spec 02). */
export function playbackOrder(
  song: Song,
  name: string | undefined,
): readonly number[] {
  const chosen = song.arrangements?.find(
    arrangement => arrangement.name === name,
  );
  return chosen !== undefined && chosen.slides.length > 0
    ? chosen.slides
    : song.slides.map((_, index) => index + 1);
}
