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

/**
 * The active group order of a grouped song's arrangement, or master order for 기본.
 * Stale or dangling IDs not found in the song are dropped so chip indices, ranges,
 * and edits stay 1:1 aligned with the active order.
 */
export function editedGroupOrder(
  song: GroupedSong,
  name: string | undefined,
): readonly SongGroupId[] {
  const raw = arrangementGroupIds(song, name);
  const known = new Set(song.groups.map(g => g.id));
  return raw.filter(id => known.has(id));
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

export interface GroupOccurrenceRange {
  readonly start: number;
  readonly length: number;
}

/**
 * Returns the 0-based starting slide index and length in the expanded playback order
 * for each group occurrence in the list of group IDs. Dangling IDs are skipped.
 */
export function groupRangesFromGroups(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): readonly GroupOccurrenceRange[] {
  const groupsById = new Map(song.groups.map(group => [group.id, group]));
  const ranges: GroupOccurrenceRange[] = [];
  let offset = 0;
  for (const id of groupIds) {
    const group = groupsById.get(id);
    if (group === undefined) continue;
    const length = group.slides.length;
    ranges.push({start: offset, length});
    offset += length;
  }
  return ranges;
}

/**
 * Returns the 0-based starting slide index and length in the expanded playback order
 * for each group occurrence in the named arrangement.
 */
export function groupRanges(
  song: GroupedSong,
  name: string | undefined,
): readonly GroupOccurrenceRange[] {
  return groupRangesFromGroups(song, editedGroupOrder(song, name));
}

/**
 * Returns the 0-based starting slide index in the expanded playback order
 * for each group occurrence in the list of group IDs.
 */
export function groupStartIndicesFromGroups(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): readonly number[] {
  return groupRangesFromGroups(song, groupIds).map(range => range.start);
}

/**
 * Returns the 0-based starting slide index in the expanded playback order
 * for each group occurrence in the named arrangement.
 */
export function groupStartIndices(
  song: GroupedSong,
  name: string | undefined,
): readonly number[] {
  return groupRanges(song, name).map(range => range.start);
}

/**
 * Maps a 0-based slide index in the expanded playback order to the group chip
 * index whose range contains the slide. Returns undefined if the slide is outside
 * all group ranges.
 */
export function chipIndexForSlide(
  slideIndex: number | undefined,
  ranges: readonly GroupOccurrenceRange[],
  totalSlides: number,
): number | undefined {
  if (slideIndex === undefined || ranges.length === 0) return undefined;
  if (slideIndex < 0 || slideIndex >= totalSlides) return undefined;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (
      range !== undefined &&
      slideIndex >= range.start &&
      slideIndex < range.start + range.length
    ) {
      return i;
    }
  }
  return undefined;
}

/**
 * One chip per group occurrence. Unnamed groups show 이름표 없음 <sourcePosition>.
 * Stale or dangling IDs not found in the song are skipped.
 */
export function groupedOrderChips(
  song: GroupedSong,
  order: readonly SongGroupId[],
  labels: readonly Label[],
): readonly ArrangementChip[] {
  const groupMap = new Map(
    song.groups.map((group, index) => [group.id, {group, position: index + 1}]),
  );
  const seen = new Map<SongGroupId, number>();
  const chips: ArrangementChip[] = [];
  for (const id of order) {
    const entry = groupMap.get(id);
    if (entry === undefined) continue;
    const occurrence = (seen.get(id) ?? 0) + 1;
    seen.set(id, occurrence);
    const {group, position} = entry;
    const name = group.name !== '' ? group.name : `이름표 없음 ${position}`;
    const color =
      group.name !== ''
        ? (labels.find(label => label.name === group.name)?.color ?? 'none')
        : 'none';
    chips.push({
      key: `${id}:${occurrence}`,
      name,
      color,
      number: position,
    });
  }
  return chips;
}

/** One chip per slide position for a version 1 song. */
export function legacyOrderChips(
  song: Song,
  order: readonly number[],
  labels: readonly Label[],
): readonly ArrangementChip[] {
  const seen = new Map<number, number>();
  const chips: ArrangementChip[] = [];
  for (const number of order) {
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

/**
 * One chip per position or group occurrence. A repeating item keeps a key
 * per occurrence, so a moved chip keeps its element and its focus.
 */
export function orderChips(
  song: GroupedSong,
  order: readonly SongGroupId[],
  labels: readonly Label[],
): readonly ArrangementChip[];
export function orderChips(
  song: Song,
  order: readonly number[],
  labels: readonly Label[],
): readonly ArrangementChip[];
export function orderChips(
  song: Song | GroupedSong,
  order: readonly number[] | readonly SongGroupId[],
  labels: readonly Label[],
): readonly ArrangementChip[];
export function orderChips(
  song: Song | GroupedSong,
  order: readonly number[] | readonly SongGroupId[],
  labels: readonly Label[],
): readonly ArrangementChip[] {
  if (isGroupedSong(song)) {
    const groupOrder: SongGroupId[] = [];
    for (const item of order) {
      if (typeof item === 'string') groupOrder.push(item);
    }
    return groupedOrderChips(song, groupOrder, labels);
  }
  const slideOrder: number[] = [];
  for (const item of order) {
    if (typeof item === 'number') slideOrder.push(item);
  }
  return legacyOrderChips(song, slideOrder, labels);
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
