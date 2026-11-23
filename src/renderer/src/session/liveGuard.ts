import {ON_SCREEN_REASON} from '@renderer/platform/problemReasons';
import {useLive} from './live';

/**
 * Why these 예배 순서 items can't be deleted: one of them is on the screens.
 * The operator moves on or clears it first.
 */
export function liveItemReason(itemIds: Iterable<string>): string | undefined {
  const live = useLive.getState().state?.layers.slide?.itemId;
  if (live == null) return undefined;
  for (const id of itemIds) if (id === live) return ON_SCREEN_REASON;
  return undefined;
}

/** Why these slides of an item can't be deleted: one of them is on the screens. */
export function liveSlideReason(
  itemId: string,
  slideIds: Iterable<string>,
): string | undefined {
  const slide = useLive.getState().state?.layers.slide;
  if (slide?.itemId !== itemId) return undefined;
  for (const id of slideIds) {
    if (id === slide.slideId) return ON_SCREEN_REASON;
  }
  return undefined;
}
