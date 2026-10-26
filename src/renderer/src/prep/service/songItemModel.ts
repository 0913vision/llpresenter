import type {Label} from '@shared/schema/labels';
import type {Song} from '@shared/schema/song';
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
