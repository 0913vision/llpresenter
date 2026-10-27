import type {Arrangement, Song} from '@shared/schema/song';
import {
  arrangementGroupIds,
  type GroupedSong,
} from '@shared/schema/groupedSong';
import {
  expandGroupSlidesWithLimit,
  type ExpandedGroupSlides,
} from '@shared/songOrder';

const NEW_ARRANGEMENT_PREFIX = '구성';
export const ARRANGEMENT_LIMIT_REASON = '슬라이드 수가 한도를 초과합니다.';

/** Default order is implicit; named orders retain repeats and empty orders. */
export function editedOrder(
  song: Song | GroupedSong,
  name: string | undefined,
): readonly number[] {
  return editedOrderWithLimit(song, name).slides;
}

/** Returns an empty order with a limit flag when expansion exceeds the tile cap. */
export function editedOrderWithLimit(
  song: Song | GroupedSong,
  name: string | undefined,
): ExpandedGroupSlides {
  if ('groups' in song) {
    return expandGroupSlidesWithLimit(song, arrangementGroupIds(song, name));
  }
  return {
    slides:
      song.arrangements?.find(arrangement => arrangement.name === name)
        ?.slides ?? song.slides.map((_, index) => index + 1),
    capped: false,
  };
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
