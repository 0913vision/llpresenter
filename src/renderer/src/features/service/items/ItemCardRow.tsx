import type {JSX} from 'react';
import type {ServiceItem} from '@core/schema/service';
import {defaultSlideTransitions} from '@core/schema/preferences';
import type {SlideTransition} from '@core/schema/slideTransition';
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
    <PropertyRow label="타이틀">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="타이틀"
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
            const apply = (existing: SlideTransition | undefined): void => {
              if (items.getSnapshot().item?.id !== item.id) return;
              saveCard(
                items,
                own
                  ? {
                      name: own.name,
                      english: own.english,
                      theme: SECTION_THEME_ID,
                      ...(existing === undefined ? {} : {transition: existing}),
                    }
                  : section === undefined
                    ? undefined
                    : (() => {
                        const {transition: _default, ...card} =
                          sectionCardOf(section);
                        return {
                          ...card,
                          ...(existing === undefined
                            ? {}
                            : {transition: existing}),
                        };
                      })(),
              );
            };
            if (
              item.sectionCard !== undefined ||
              (own === undefined && section === undefined)
            ) {
              apply(item.sectionCard?.transition);
            } else if (window.llp === undefined) {
              apply(defaultSlideTransitions.section);
            } else {
              void window.llp.preferences.get().then(
                preferences => apply(preferences.show.slideDefaults.section),
                (error: unknown) =>
                  console.error('Could not read transition defaults', error),
              );
            }
          }}
        />
      )}
    </PropertyRow>
  );
}
