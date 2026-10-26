import type {Label} from '@shared/schema/labels';
import type {Song} from '@shared/schema/song';
import {playbackOrder} from '@shared/songOrder';
import type {SongPicture} from '@renderer/prep/editor';
import type {ArrangementChip} from '@renderer/ui/LabelChip';

/** The 이름표 of a 슬라이드, or `undefined` when it has none. */
export function slideLabel(song: Song, number: number): string | undefined {
  const label = song.slides[number - 1]?.label;
  return label === '' ? undefined : label;
}

/**
 * One chip per position. A 슬라이드 that repeats keeps a key per occurrence,
 * so a moved chip keeps its element and its focus.
 */
export function orderChips(
  song: Song,
  order: readonly number[],
  labels: readonly Label[],
): readonly ArrangementChip[] {
  const seen = new Map<number, number>();
  return order.map(number => {
    const occurrence = (seen.get(number) ?? 0) + 1;
    seen.set(number, occurrence);
    const name = slideLabel(song, number);
    return {
      key: `${number}:${occurrence}`,
      name,
      color: labels.find(label => label.name === name)?.color ?? 'none',
      number,
    };
  });
}

/** The selected place clamped to an order, or `undefined` for an empty one. */
export function shownPosition(
  position: number,
  length: number,
): number | undefined {
  return length === 0 ? undefined : Math.min(position, length - 1);
}

/** The order with the position at `from` moved to `to`. */
export function movedOrder(
  order: readonly number[],
  from: number,
  to: number,
): readonly number[] {
  const moved = [...order];
  const [number] = moved.splice(from, 1);
  if (number !== undefined) moved.splice(to, 0, number);
  return moved;
}

/** The order without the position at `index`; the 슬라이드 stays in the song. */
export function withoutPosition(
  order: readonly number[],
  index: number,
): readonly number[] {
  return order.filter((_, at) => at !== index);
}

/**
 * The 슬라이드 the item's preview draws: the selected place in the order the
 * item plays, on the item's background or else the song's.
 */
export function itemPicture({
  song,
  arrangement,
  position,
  background,
}: {
  readonly song: Song;
  readonly arrangement: string | undefined;
  readonly position: number;
  readonly background: string | undefined;
}): SongPicture | null {
  const sequence = playbackOrder(song, arrangement);
  const at = shownPosition(position, sequence.length);
  const number = at === undefined ? undefined : sequence[at];
  if (at === undefined || number === undefined) return null;
  return {
    song,
    block: number - 1,
    background,
    position: at + 1,
    total: sequence.length,
  };
}
