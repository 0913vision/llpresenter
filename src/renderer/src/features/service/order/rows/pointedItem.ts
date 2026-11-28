import type {PickedSlideItem} from '@renderer/session/show/visibleSlideItem';

/**
 * The row of the 예배 순서 the blue band marks while the continuous slide grid
 * shows (decision Nov 28, leaning to LIVE): a row the operator picked, by a
 * click or 다음 항목, until they scroll again or another slide goes out; else the live
 * item while its slide is in sight of the grid; else the item at the top of
 * the grid.
 */
export function pointedItem({
  picked,
  liveSlide,
  liveItemId,
  liveInSight,
  topItemId,
}: {
  readonly picked: PickedSlideItem | null;
  /** The slide on the screens, as `liveSlideKey` names it. */
  readonly liveSlide: string | null;
  readonly liveItemId: string | null;
  readonly liveInSight: boolean;
  readonly topItemId: string | null;
}): string | null {
  if (picked !== null && picked.liveAt === liveSlide) return picked.id;
  if (liveItemId !== null && liveInSight) return liveItemId;
  return topItemId;
}
