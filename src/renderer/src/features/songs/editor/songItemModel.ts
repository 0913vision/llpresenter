import type {Song} from '@core/schema/song';
import type {SongPicture} from './SongPreview';

/** The selected place clamped to an order, or `undefined` for an empty one. */
export function shownPosition(
  position: number,
  length: number,
): number | undefined {
  return length === 0 ? undefined : Math.min(position, length - 1);
}

export function itemPicture({
  song,
  position,
  background,
}: {
  readonly song: Song;
  readonly position: number;
  readonly background: string | undefined;
}): SongPicture | null {
  const sequence = song.slides.map((_, index) => index + 1);
  const at = shownPosition(position, sequence.length);
  const number = at === undefined ? undefined : sequence[at];
  if (at === undefined || number === undefined) return null;
  const next = sequence[at + 1];
  return {
    song,
    block: number - 1,
    nextBlock: next === undefined ? undefined : next - 1,
    background,
    position: at + 1,
    total: sequence.length,
  };
}
