import {sameJson} from '@core/common/sameJson';
import type {Service} from '@core/schema/services/service';

type Order = Service['order'];

/** Where a change of the 예배 순서 shows: its item, and the first slide of it that differs. */
export interface ChangedPlace {
  readonly itemId: string;
  readonly slideId?: string | undefined;
}

function slidesOf(item: Order[number] | undefined) {
  return item !== undefined && 'slides' in item ? item.slides : undefined;
}

/**
 * The first item of `to` that is not the same in `from`, and in it the first
 * slide that changed, came back or moved. Undefined when `to` only lost items.
 */
export function changedPlace(from: Order, to: Order): ChangedPlace | undefined {
  const before = new Map(from.map(item => [item.id, item]));
  for (const [index, item] of to.entries()) {
    const was = before.get(item.id);
    if (
      was !== undefined &&
      sameJson(was, item) &&
      from[index]?.id === item.id
    ) {
      continue;
    }
    const slides = slidesOf(item);
    const old = slidesOf(was);
    if (slides === undefined || old === undefined) return {itemId: item.id};
    const slide = slides.find(
      (each, at) => old[at]?.id !== each.id || !sameJson(old[at], each),
    );
    return {itemId: item.id, slideId: (slide ?? slides.at(-1))?.id};
  }
  return undefined;
}
