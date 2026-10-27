import type {Arrangement, Song} from '@shared/schema/song';
import {
  arrangementGroupIds,
  type GroupedSong,
} from '@shared/schema/groupedSong';
import {expandGroupSlides} from '@shared/songOrder';

const NEW_ARRANGEMENT_PREFIX = '구성';

/** Default order is implicit; named orders retain repeats and empty orders. */
export function editedOrder(
  song: Song | GroupedSong,
  name: string | undefined,
): readonly number[] {
  if ('groups' in song) {
    return expandGroupSlides(song, arrangementGroupIds(song, name));
  }
  return (
    song.arrangements?.find(arrangement => arrangement.name === name)?.slides ??
    song.slides.map((_, index) => index + 1)
  );
}

/** Whether two orders list the same items in the same places. */
export function sameOrder(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** Copies the selected order under the first unused numbered name. */
export function newArrangement(
  song: Song,
  selected: string | undefined,
): Arrangement {
  const names = new Set(song.arrangements?.map(({name}) => name));
  let number = 1;
  while (names.has(`${NEW_ARRANGEMENT_PREFIX} ${number}`)) number++;
  return {
    name: `${NEW_ARRANGEMENT_PREFIX} ${number}`,
    slides: [...editedOrder(song, selected)],
  };
}
