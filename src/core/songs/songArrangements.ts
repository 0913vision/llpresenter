import {limitReason} from '../common/limitReason';
import {SHOW_SERVICE_LIMITS} from '../schema/showService';
import {DEFAULT_ARRANGEMENT_NAME} from '../schema/song';
import {arrangementGroupIds, type GroupedSong} from '../schema/groupedSong';
import {
  expandGroupSlidesWithLimit,
  type ExpandedGroupSlides,
} from './songOrder';

export const ARRANGEMENT_LIMIT_REASON = limitReason(
  '슬라이드',
  SHOW_SERVICE_LIMITS.tiles,
  '사용',
);

/** The implicit default order followed by the song's named arrangements. */
export function arrangementOptions(song: GroupedSong) {
  return [
    DEFAULT_ARRANGEMENT_NAME,
    ...(song.arrangements?.map(item => item.name) ?? []),
  ].map(value => ({value, label: value}));
}

/** Default order is implicit; named orders retain repeats and empty orders. */
export function editedOrder(
  song: GroupedSong,
  name: string | undefined,
): readonly number[] {
  return editedOrderWithLimit(song, name).slides;
}

/** Returns an empty order with a limit flag when expansion exceeds the tile cap. */
export function editedOrderWithLimit(
  song: GroupedSong,
  name: string | undefined,
): ExpandedGroupSlides {
  return expandGroupSlidesWithLimit(song, arrangementGroupIds(song, name));
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
