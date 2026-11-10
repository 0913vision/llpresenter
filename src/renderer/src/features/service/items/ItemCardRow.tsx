import type {JSX} from 'react';
import type {ServiceItem} from '@core/schema/service';
import {
  canHaveSectionCard,
  hasSectionCard,
  newSectionCard,
} from '@core/services/sectionCards';
import {Checkbox} from '@renderer/ui/Checkbox';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import type {ServiceItemStore} from './serviceItemStore';
import {setItemCard} from './cardSlideModel';

/** The checkbox and the slide editor write the same service-local card. */
export function ItemCardRow({
  items,
  item,
  reason,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItem;
  readonly reason: string | undefined;
}): JSX.Element | null {
  if (!canHaveSectionCard(item)) {
    return null;
  }
  const service = items.getSnapshot().service;
  return (
    <PropertyRow label="구역 이름 슬라이드">
      {({controlId}) => (
        <Checkbox
          id={controlId}
          checked={hasSectionCard(item)}
          disabled={reason !== undefined || service === null}
          title={reason}
          onChange={checked => {
            if (service === null) return;
            items
              .submitItemEdit({
                target: {serviceId: service.service.id, itemId: item.id},
                failure: '구역 이름 저장 실패',
                change: current => {
                  if (!canHaveSectionCard(current)) {
                    return null;
                  }
                  return setItemCard(
                    current,
                    checked
                      ? (current.sectionCard ?? newSectionCard())
                      : undefined,
                  );
                },
              })
              .catch((error: unknown) => console.error(error));
          }}
        />
      )}
    </PropertyRow>
  );
}
