import type {Song} from './schema/song';
import type {GroupedSong} from './schema/groupedSong';
import type {SongGroupId} from './schema/ids';

/** Expands an arrangement's group sequence into linear 1-based slide numbers. */
export function expandGroupSlides(
  song: GroupedSong,
  groupIds: readonly SongGroupId[],
): readonly number[] {
  const groupOffset = new Map<string, number>();
  let offset = 1;
  for (const group of song.groups) {
    groupOffset.set(group.id, offset);
    offset += group.slides.length;
  }
  const groupsById = new Map(song.groups.map(g => [g.id, g]));
  const result: number[] = [];
  for (const id of groupIds) {
    const group = groupsById.get(id);
    const start = groupOffset.get(id);
    if (group === undefined || start === undefined) continue;
    for (let i = 0; i < group.slides.length; i++) {
      result.push(start + i);
    }
  }
  return result;
}

/**
 * Playback order for a grouped song: uses file order when the named order
 * is missing or empty (spec 02).
 */
export function groupedPlaybackOrder(
  song: GroupedSong,
  name: string | undefined,
): readonly number[] {
  const chosen =
    name === undefined
      ? undefined
      : song.arrangements?.find(item => item.name === name);
  const groupIds =
    chosen !== undefined && chosen.groups.length > 0
      ? chosen.groups
      : song.groups.map(g => g.id);
  return expandGroupSlides(song, groupIds);
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
