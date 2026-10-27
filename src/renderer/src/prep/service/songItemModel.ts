import type {Label} from '@shared/schema/labels';
import type {Song} from '@shared/schema/song';
import {
  arrangementGroupIds,
  isGroupedSong,
  type GroupedSong,
} from '@shared/schema/groupedSong';
import type {SongGroupId} from '@shared/schema/ids';
import {playbackOrder} from '@shared/songOrder';
import type {SongPicture} from '@renderer/prep/editor';
import {linearSlidesOf} from '@renderer/prep/editor/blockEdits';
import type {ArrangementChip} from '@renderer/ui/LabelChip';

/** The 이름표 of a 슬라이드, or `undefined` when it has none. */
export function slideLabel(
  song: Song | GroupedSong,
  number: number,
): string | undefined {
  const slides = 'slides' in song ? song.slides : linearSlidesOf(song);
  const label = slides[number - 1]?.label;
  return label === '' ? undefined : label;
}

/** The active group order of a grouped song's arrangement, or master order for 기본. */
export function editedGroupOrder(
  song: GroupedSong,
  name: string | undefined,
): readonly SongGroupId[] {
  return arrangementGroupIds(song, name);
}

/** Whether two sequences list the same items in the same places. */
export function sameSequence<T>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * Returns the 0-based starting slide index in the expanded playback order
 * for each group occurrence in the list of group IDs.
 */
export function groupStartIndicesFromGroups(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): readonly number[] {
  const groupsById = new Map(song.groups.map(group => [group.id, group]));
  const starts: number[] = [];
  let offset = 0;
  for (const id of groupIds) {
    starts.push(offset);
    const group = groupsById.get(id);
    offset += group?.slides.length ?? 0;
  }
  return starts;
}

/**
 * Returns the 0-based starting slide index in the expanded playback order
 * for each group occurrence in the named arrangement.
 */
export function groupStartIndices(
  song: GroupedSong,
  name: string | undefined,
): readonly number[] {
  return groupStartIndicesFromGroups(song, editedGroupOrder(song, name));
}

/**
 * Maps a 0-based slide index in the expanded playback order to its
 * corresponding group chip index in the arrangement.
 */
export function chipIndexForSlide(
  slideIndex: number | undefined,
  starts: readonly number[],
  totalSlides: number,
): number | undefined {
  if (slideIndex === undefined || starts.length === 0) return undefined;
  if (slideIndex < 0 || slideIndex >= totalSlides) return undefined;
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i];
    if (start !== undefined && slideIndex >= start) {
      return i;
    }
  }
  return 0;
}

/**
 * One chip per position or group occurrence. A repeating item keeps a key
 * per occurrence, so a moved chip keeps its element and its focus.
 */
export function orderChips(
  song: Song | GroupedSong,
  order: readonly number[] | readonly SongGroupId[],
  labels: readonly Label[],
): readonly ArrangementChip[] {
  if (isGroupedSong(song)) {
    const groupMap = new Map(
      song.groups.map((group, index) => [
        group.id,
        {group, position: index + 1},
      ]),
    );
    const seen = new Map<SongGroupId, number>();
    const chips: ArrangementChip[] = [];
    for (const item of order) {
      if (typeof item !== 'string') continue;
      const entry = groupMap.get(item);
      const occurrence = (seen.get(item) ?? 0) + 1;
      seen.set(item, occurrence);
      const position = entry?.position ?? 0;
      const groupName = entry?.group.name ?? '';
      const name = groupName !== '' ? groupName : `이름표 없음 ${position}`;
      const color =
        groupName !== ''
          ? (labels.find(label => label.name === groupName)?.color ?? 'none')
          : 'none';
      chips.push({
        key: `${item}:${occurrence}`,
        name,
        color,
        number: position,
      });
    }
    return chips;
  }
  const seen = new Map<number, number>();
  const chips: ArrangementChip[] = [];
  for (const number of order) {
    if (typeof number !== 'number') continue;
    const occurrence = (seen.get(number) ?? 0) + 1;
    seen.set(number, occurrence);
    const name = slideLabel(song, number);
    chips.push({
      key: `${number}:${occurrence}`,
      name,
      color: labels.find(label => label.name === name)?.color ?? 'none',
      number,
    });
  }
  return chips;
}

/** The selected place clamped to an order, or `undefined` for an empty one. */
export function shownPosition(
  position: number,
  length: number,
): number | undefined {
  return length === 0 ? undefined : Math.min(position, length - 1);
}

/** The order with the item at `from` moved to `to`. */
export function movedOrder<T>(
  order: readonly T[],
  from: number,
  to: number,
): readonly T[] {
  const moved = [...order];
  const [item] = moved.splice(from, 1);
  if (item !== undefined) moved.splice(to, 0, item);
  return moved;
}

/** The order without the item at `index`. */
export function withoutPosition<T>(
  order: readonly T[],
  index: number,
): readonly T[] {
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
  readonly song: Song | GroupedSong;
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
