import type {Song} from '../schema/song';
import type {GroupedSong} from '../schema/groupedSong';
import type {SongGroupId} from '../schema/ids';
import {SHOW_SERVICE_LIMITS} from '../schema/showService';

export interface ExpandedGroupSlides {
  readonly slides: readonly number[];
  readonly capped: boolean;
}

/** Expands an arrangement's group sequence into linear 1-based slide numbers. */
export function expandGroupSlides(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): readonly number[] {
  return expandGroupSlidesWithLimit(song, groupIds).slides;
}

/** Refuses oversized expanded orders before allocating their slide numbers. */
export function expandGroupSlidesWithLimit(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): ExpandedGroupSlides {
  const groups = new Map<string, {start: number; length: number}>();
  let offset = 1;
  for (const group of song.groups) {
    groups.set(group.id, {start: offset, length: group.slides.length});
    offset += group.slides.length;
  }
  let count = 0;
  for (const id of groupIds) {
    count += groups.get(id)?.length ?? 0;
    if (count > SHOW_SERVICE_LIMITS.tiles) return {slides: [], capped: true};
  }
  const result: number[] = [];
  for (const id of groupIds) {
    const group = groups.get(id);
    if (group === undefined) continue;
    for (let i = 0; i < group.length; i++) {
      result.push(group.start + i);
    }
  }
  return {slides: result, capped: false};
}

/**
 * Resolves the group sequence for playback: falls back to all groups in file order
 * when the arrangement is missing or empty (spec 02).
 */
export function playbackGroupIds(
  song: GroupedSong,
  name: string | undefined,
): readonly SongGroupId[] {
  const chosen =
    name === undefined
      ? undefined
      : song.arrangements?.find(item => item.name === name);
  return chosen !== undefined && chosen.groups.length > 0
    ? chosen.groups
    : song.groups.map(g => g.id);
}

/**
 * Playback order for a grouped song: uses file order when the named order
 * is missing or empty (spec 02).
 */
export function groupedPlaybackOrder(
  song: GroupedSong,
  name: string | undefined,
): readonly number[] {
  return expandGroupSlides(song, playbackGroupIds(song, name));
}

/** Playback uses file order when the named order is missing or empty (spec 02). */
export function playbackOrder(
  song: Song | GroupedSong,
  name: string | undefined,
): readonly number[] {
  if ('groups' in song) {
    return groupedPlaybackOrder(song, name);
  }
  const chosen = song.arrangements?.find(
    arrangement => arrangement.name === name,
  );
  return chosen !== undefined && chosen.slides.length > 0
    ? chosen.slides
    : song.slides.map((_, index) => index + 1);
}
