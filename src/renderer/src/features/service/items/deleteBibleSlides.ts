import {
  changeBibleSlides,
  isPassageItem,
  keptSlides,
  passageOf,
  slideIds,
  withPassage,
} from '@core/services/passageEdits';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ShowTile} from '@core/schema/showService';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {ServiceItemStore} from './serviceItemStore';

/** Takes these slides out of a passage or sermon item. */
export function deleteBibleSlides({
  items,
  serviceId,
  itemId,
  tiles,
  lookup,
  removeCard,
}: {
  readonly items: ServiceItemStore;
  readonly serviceId: string;
  readonly itemId: string;
  readonly tiles: readonly ShowTile[];
  readonly lookup: BibleLookupPassage | undefined;
  readonly removeCard: boolean;
}): Promise<boolean> {
  const keys = new Set(tiles.map(tile => tile.key));
  return items.submitItemEdit({
    target: {serviceId, itemId},
    failure: '슬라이드 삭제 실패',
    change: fresh => {
      if (!isPassageItem(fresh)) return null;
      let updated: ServiceItem = fresh;
      const passage = passageOf(fresh);
      if (lookup !== undefined && slideIds(tiles).size > 0) {
        updated = withPassage(fresh, {
          ...passage,
          slides: changeBibleSlides(
            keptSlides(passage, lookup),
            slideIds(tiles),
            () => null,
          ),
        });
      }
      if (isItemOfKind(updated, 'sermon')) {
        updated = {
          ...updated,
          sermon: {
            ...updated.sermon,
            ...(keys.has('sermon:opening') ? {openingHidden: true} : {}),
            ...(keys.has('sermon:closing') ? {closingHidden: true} : {}),
          },
        };
      }
      if (!removeCard || !('sectionCard' in updated)) return updated;
      const {sectionCard: _card, ...rest} = updated;
      return rest;
    },
  });
}
