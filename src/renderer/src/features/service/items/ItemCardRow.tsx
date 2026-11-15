import type {JSX} from 'react';
import type {ServiceItem} from '@core/schema/service';
import {
  canHaveSectionCard,
  isStandaloneCard,
  sectionCardOf,
} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS, SECTION_THEME_ID} from '@core/themes/sundaySections';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
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
  const document = useSettingsDocument('themes', '테마', undefined);
  if (!canHaveSectionCard(item)) return null;
  const service = items.getSnapshot().service;
  const custom = document?.value.customSections ?? [];
  const selected = custom.find(
    entry =>
      entry.name === item.sectionCard?.name &&
      entry.english === item.sectionCard.english,
  );
  const value = selected
    ? `custom:${selected.id}`
    : (item.sectionCard?.name ?? '');
  return (
    <PropertyRow label="구역 이름">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="구역 이름"
          value={value}
          valueText={item.sectionCard?.name ?? '없음'}
          options={[
            ...(isStandaloneCard(item) ? [] : [{value: '', label: '없음'}]),
            ...SUNDAY_SECTIONS.map(section => ({
              value: section.name,
              label: section.name,
            })),
            ...custom.map(section => ({
              value: `custom:${section.id}`,
              label: section.name,
            })),
          ]}
          disabled={reason !== undefined || service === null}
          title={reason}
          onChange={next => {
            if (next === value) return;
            const section = SUNDAY_SECTIONS.find(entry => entry.name === next);
            const own = custom.find(entry => `custom:${entry.id}` === next);
            saveCard(
              items,
              own
                ? {
                    name: own.name,
                    english: own.english,
                    theme: SECTION_THEME_ID,
                  }
                : section === undefined
                  ? undefined
                  : sectionCardOf(section),
            );
          }}
        />
      )}
    </PropertyRow>
  );
}
