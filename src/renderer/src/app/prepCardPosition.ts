import {cardOffset} from '@core/services/sectionCards';
import type {ServiceItemOf} from '@core/schema/service';

/** Translate an item-visible slide position into its content slide index. */
export function contentPosition(
  item: ServiceItemOf<'song' | 'slides'>,
  position: number | undefined,
): number {
  return Math.max(0, (position ?? 0) - cardOffset(item));
}
