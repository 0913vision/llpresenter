import type {JSX} from 'react';
import type {ServiceItem} from '@core/schema/service';
import {
  canHaveSectionCard,
  isStandaloneCard,
  sectionCardOf,
} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import type {ServiceItemStore} from './serviceItemStore';
import {saveCard} from './sectionCardActions';

/** Choose the same item-owned card used by the slide editor. */
export function ItemCardRow({
  items,
  item,
  reason,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItem;
  readonly reason: string | undefined;
}): JSX.Element | null {
  if (!canHaveSectionCard(item)) return null;
  const service = items.getSnapshot().service;
  const value = item.sectionCard?.name ?? '';
  return (
    <PropertyRow label="구역 이름">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="구역 이름"
          value={value}
          valueText={value || '없음'}
          options={[
            ...(isStandaloneCard(item) ? [] : [{value: '', label: '없음'}]),
            ...SUNDAY_SECTIONS.map(section => ({
              value: section.name,
              label: section.name,
            })),
          ]}
          disabled={reason !== undefined || service === null}
          title={reason}
          onChange={next => {
            if (next === value) return;
            const section = SUNDAY_SECTIONS.find(entry => entry.name === next);
            saveCard(
              items,
              section === undefined ? undefined : sectionCardOf(section),
            );
          }}
        />
      )}
    </PropertyRow>
  );
}
